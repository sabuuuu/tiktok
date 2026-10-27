import { hashtagsFor, topicsFor } from "./topics";
import type { DashboardData, Video } from "./types";

// Lifetime views keep climbing for a few days; newer videos would look like flops.
export const MATURE_DAYS = 7;
const DAY = 86400;
const BASELINE_NEIGHBORS = 20;
const MIN_SAMPLES = 3;

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const TIME_BLOCKS = ["0–4h", "4–8h", "8–12h", "12–16h", "16–20h", "20–24h"];
// The API reports duration 0 for photo/carousel posts.
export const DURATION_BUCKETS = [
  { label: "Photo / carousel", max: 1 },
  { label: "< 15s", max: 15 },
  { label: "15–30s", max: 30 },
  { label: "30–60s", max: 60 },
  { label: "1–3 min", max: 180 },
  { label: "3 min +", max: Infinity },
];

export type EnrichedVideo = Video & {
  mature: boolean;
  weekday: number; // 0 = Monday
  hour: number;
  topics: string[];
  hashtags: string[];
  engagementRate: number; // (likes + comments + shares) / views
  shareRate: number;
  commentRate: number;
  /** views ÷ median views of the videos posted around the same time. 1 = typical, 2 = twice as good. */
  index: number | null;
};

export type Group = { label: string; count: number; medianIndex: number; medianViews: number };

export type Insight = {
  kind: "do" | "avoid" | "info";
  title: string;
  detail: string;
};

export function median(values: number[]) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function localParts(unix: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date(unix * 1000));
  const weekday = WEEKDAYS.indexOf(parts.find((p) => p.type === "weekday")!.value);
  const hour = Number(parts.find((p) => p.type === "hour")!.value);
  return { weekday, hour };
}

function group(videos: EnrichedVideo[], keyOf: (v: EnrichedVideo) => string[], labels?: string[]): Group[] {
  const map = new Map<string, EnrichedVideo[]>();
  for (const label of labels ?? []) map.set(label, []);
  for (const v of videos) for (const k of keyOf(v)) map.set(k, [...(map.get(k) ?? []), v]);
  return [...map].map(([label, vs]) => ({
    label,
    count: vs.length,
    medianIndex: median(vs.map((v) => v.index!)),
    medianViews: median(vs.map((v) => v.views)),
  }));
}

const fmtX = (n: number) => `${n.toFixed(1)}×`;

export function analyze(data: DashboardData, timeZone: string, now = Date.now() / 1000) {
  const sorted = [...data.videos].sort((a, b) => a.createdAt - b.createdAt);

  const enriched: EnrichedVideo[] = sorted.map((v) => {
    const text = `${v.title} ${v.description}`;
    const interactions = v.likes + v.comments + v.shares;
    return {
      ...v,
      ...localParts(v.createdAt, timeZone),
      mature: now - v.createdAt >= MATURE_DAYS * DAY,
      topics: topicsFor(text),
      hashtags: hashtagsFor(text),
      engagementRate: v.views ? interactions / v.views : 0,
      shareRate: v.views ? v.shares / v.views : 0,
      commentRate: v.views ? v.comments / v.views : 0,
      index: null,
    };
  });

  // Baseline = median of the closest-in-time mature videos, so channel growth doesn't
  // make every old video look bad and every new one look great.
  const mature = enriched.filter((v) => v.mature);
  for (const v of mature) {
    const neighbors = mature
      .filter((o) => o.id !== v.id)
      .sort((a, b) => Math.abs(a.createdAt - v.createdAt) - Math.abs(b.createdAt - v.createdAt))
      .slice(0, BASELINE_NEIGHBORS);
    const base = median(neighbors.map((o) => o.views));
    v.index = base > 0 ? v.views / base : null;
  }
  const scored = mature.filter((v) => v.index !== null);

  const blockOf = (v: EnrichedVideo) => Math.floor(v.hour / 4);
  const heatmap = WEEKDAYS.map((_, d) =>
    TIME_BLOCKS.map((_, b) => {
      const vs = scored.filter((v) => v.weekday === d && blockOf(v) === b);
      return { count: vs.length, medianIndex: vs.length ? median(vs.map((v) => v.index!)) : null };
    }),
  );

  const byDay = group(scored, (v) => [WEEKDAYS[v.weekday]], WEEKDAYS);
  const byBlock = group(scored, (v) => [TIME_BLOCKS[blockOf(v)]], TIME_BLOCKS);
  const byTopic = group(scored, (v) => (v.topics.length ? v.topics : ["(no topic)"]))
    .filter((g) => g.count >= 2)
    .sort((a, b) => b.medianIndex - a.medianIndex);
  const byHashtag = group(scored, (v) => v.hashtags)
    .filter((g) => g.count >= MIN_SAMPLES)
    .sort((a, b) => b.medianIndex - a.medianIndex);
  const byDuration = group(
    scored,
    (v) => [DURATION_BUCKETS.find((b) => v.duration < b.max)!.label],
    DURATION_BUCKETS.map((b) => b.label),
  );

  // Compare like with like: only videos old enough to have collected most of their views.
  const ageDays = (v: EnrichedVideo) => (now - v.createdAt) / DAY;
  const last30 = enriched.filter((v) => v.mature && ageDays(v) < MATURE_DAYS + 30);
  const prev30 = enriched.filter((v) => ageDays(v) >= MATURE_DAYS + 30 && ageDays(v) < MATURE_DAYS + 60);
  const recentMature = scored.filter((v) => now - v.createdAt < 90 * DAY);

  const weeks = 8;
  const cadence = Array.from({ length: weeks }, (_, i) => {
    const end = now - (weeks - 1 - i) * 7 * DAY;
    return enriched.filter((v) => v.createdAt <= end && v.createdAt > end - 7 * DAY).length;
  });
  const lastPost = enriched.at(-1);

  const totals = {
    medianViews30: median(last30.map((v) => v.views)),
    // Too few posts in either window makes the comparison meaningless.
    medianViewsPrev30: last30.length >= 3 && prev30.length >= 3 ? median(prev30.map((v) => v.views)) : 0,
    posts30: last30.length,
    engagement: median(recentMature.map((v) => v.engagementRate)),
    shareRate: median(recentMature.map((v) => v.shareRate)),
    postsPerWeek: cadence.reduce((a, b) => a + b, 0) / weeks,
    daysSinceLastPost: lastPost ? Math.floor((now - lastPost.createdAt) / DAY) : null,
  };

  // ---- Plain-language recommendations -------------------------------------------------
  const insights: Insight[] = [];
  const reliable = (gs: Group[]) => gs.filter((g) => g.count >= MIN_SAMPLES).sort((a, b) => b.medianIndex - a.medianIndex);

  const topics = reliable(byTopic).filter((g) => g.label !== "(no topic)");
  if (topics.length >= 2) {
    const best = topics[0];
    const worst = topics.at(-1)!;
    if (best.medianIndex >= 1.15)
      insights.push({
        kind: "do",
        title: `Make more “${best.label}” videos`,
        detail: `They get ${fmtX(best.medianIndex)} your usual views (median of ${best.count} videos). Try a series format so viewers come back for part 2.`,
      });
    if (worst.medianIndex <= 0.85)
      insights.push({
        kind: "avoid",
        title: `“${worst.label}” underperforms`,
        detail: `${fmtX(worst.medianIndex)} your usual views across ${worst.count} videos. Rework the angle (stronger hook, relatable problem) or post it less.`,
      });
  }

  const days = reliable(byDay);
  const blocks = reliable(byBlock);
  if (days.length >= 3 && days[0].medianIndex >= 1.1)
    insights.push({
      kind: "do",
      title: `${days[0].label} is your best day`,
      detail: `${fmtX(days[0].medianIndex)} usual views (${days[0].count} videos). Weakest: ${days.at(-1)!.label} at ${fmtX(days.at(-1)!.medianIndex)}.`,
    });
  if (blocks.length >= 2 && blocks[0].medianIndex >= 1.1)
    insights.push({
      kind: "do",
      title: `Post around ${blocks[0].label} (${timeZone})`,
      detail: `Videos posted in that window get ${fmtX(blocks[0].medianIndex)} usual views (${blocks[0].count} videos). Cross-check with “Followers activity” in TikTok Studio, which the API doesn't expose.`,
    });

  const durations = reliable(byDuration);
  if (durations.length >= 2 && durations[0].medianIndex >= 1.1)
    insights.push({
      kind: "do",
      title: `Best format/length: ${durations[0].label}`,
      detail: `${fmtX(durations[0].medianIndex)} usual views across ${durations[0].count} videos. Views aren't everything — check average watch time in TikTok Studio on your top ones.`,
    });

  const topShared = [...recentMature].sort((a, b) => b.shareRate - a.shareRate).slice(0, 5);
  if (topShared.length >= 3) {
    const common = group(topShared, (v) => v.topics).sort((a, b) => b.count - a.count)[0];
    insights.push({
      kind: "info",
      title: "Shares are your strongest growth signal",
      detail: `Your 5 most-shared videos (per view) ${common && common.count >= 2 ? `are mostly about “${common.label}”` : "are listed in the table — sort by share rate"}. Shareable = useful (save-worthy tips) or relatable (“tag a dev who…”).`,
    });
  }

  if (totals.postsPerWeek < 3)
    insights.push({
      kind: "do",
      title: "Post more consistently",
      detail: `You averaged ${totals.postsPerWeek.toFixed(1)} posts/week over the last 8 weeks. 3–5/week gives the algorithm (and this dashboard) enough data to learn from.`,
    });
  if (totals.daysSinceLastPost !== null && totals.daysSinceLastPost >= 7)
    insights.push({
      kind: "avoid",
      title: `${totals.daysSinceLastPost} days since your last post`,
      detail: "Long gaps tend to cool down distribution. A quick reply-to-comment video is an easy restart.",
    });

  if (scored.length < 15)
    insights.push({
      kind: "info",
      title: "Not much data yet",
      detail: `Only ${scored.length} videos are older than ${MATURE_DAYS} days. Treat patterns as hints until you have ~30.`,
    });

  return {
    videos: enriched,
    scoredCount: scored.length,
    heatmap,
    byDay,
    byBlock,
    byTopic,
    byHashtag: byHashtag.slice(0, 12),
    byDuration,
    cadence,
    totals,
    insights,
  };
}

export type Analysis = ReturnType<typeof analyze>;
