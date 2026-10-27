import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ColumnChart, Heatmap, IndexBars, LineChart } from "@/components/charts";
import { VideoTable } from "@/components/VideoTable";
import { analyze, MATURE_DAYS, TIME_BLOCKS, WEEKDAYS, type Insight } from "@/lib/analytics";
import { loadDashboard } from "@/lib/data";
import { caption, compact, pct, shortDate, times } from "@/lib/format";
import { isConfigured } from "@/lib/tiktok";

const timeZone = process.env.TIMEZONE || Intl.DateTimeFormat().resolvedOptions().timeZone;

function Card({ title, subtitle, children, className = "" }: { title: string; subtitle?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-line bg-surface p-5 ${className}`}>
      <h2 className="font-semibold">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Stat({ label, value, delta, hint }: { label: string; value: string; delta?: { text: string; good: boolean } | null; hint?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="text-sm text-ink-2">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {delta && <div className={`mt-1 text-xs ${delta.good ? "text-good" : "text-bad"}`}>{delta.good ? "▲" : "▼"} {delta.text}</div>}
      {hint && !delta && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

const INSIGHT_STYLE: Record<Insight["kind"], { icon: string; label: string; color: string }> = {
  do: { icon: "✓", label: "Do", color: "var(--good)" },
  avoid: { icon: "!", label: "Watch out", color: "var(--critical)" },
  info: { icon: "i", label: "Note", color: "var(--series-1)" },
};

export default async function Page({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const result = await loadDashboard(params.demo === "1");
  if (result.status === "needs-refresh") redirect("/api/auth/refresh");

  const { data } = result;
  const a = analyze(data, timeZone);
  const { profile, snapshots } = data;
  const connected = data.source === "tiktok";
  const error = result.status === "error" ? result.message : typeof params.error === "string" ? params.error : null;

  const recent = a.videos.slice(-60);
  const matureViews = a.videos.filter((v) => v.mature).slice(-30).map((v) => v.views).sort((x, y) => x - y);
  const usual = matureViews.length ? matureViews[matureViews.length >> 1] : undefined;

  const week = snapshots.length > 7 ? snapshots.at(-8)! : snapshots[0];
  const followerDelta = snapshots.length > 1 ? profile.followers - week.followers : null;
  const viewsDelta = a.totals.medianViewsPrev30 ? a.totals.medianViews30 / a.totals.medianViewsPrev30 - 1 : null;

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-center gap-4">
        {profile.avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatarUrl} alt="" className="size-12 rounded-full" />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold">{profile.displayName}</h1>
          <p className="text-sm text-muted">
            @{profile.username} · {profile.videoCount} videos · times in {timeZone}
          </p>
        </div>
        {connected ? (
          <form action="/api/auth/logout" method="post">
            <button className="rounded-lg border border-line px-3 py-2 text-sm hover:bg-[var(--grid)]">Disconnect</button>
          </form>
        ) : (
          <a href="/api/auth/login" className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-page hover:opacity-90">
            Connect TikTok
          </a>
        )}
      </header>

      {!connected && (
        <div className="rounded-xl border border-line bg-surface p-4 text-sm text-ink-2">
          <strong className="text-ink">You&apos;re looking at sample data.</strong>{" "}
          {isConfigured()
            ? "Click “Connect TikTok” to load your own channel."
            : "Fill in .env.local (see .env.example and the README) to connect your real account."}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-[var(--critical)] bg-surface p-4 text-sm">
          <strong>Problem:</strong> {error === "not-configured" ? "TikTok credentials are missing from .env.local." : error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat
          label="Followers"
          value={compact(profile.followers)}
          delta={followerDelta !== null ? { text: `${compact(Math.abs(followerDelta))} vs ${week.date}`, good: followerDelta >= 0 } : null}
          hint="Growth tracked from today"
        />
        <Stat
          label="Median views · recent"
          value={compact(a.totals.medianViews30)}
          delta={viewsDelta !== null ? { text: `${pct(Math.abs(viewsDelta), 0)} vs previous 30`, good: viewsDelta >= 0 } : null}
          hint={`${a.totals.posts30} posts, 7–37 days old`}
        />
        <Stat label="Engagement rate" value={pct(a.totals.engagement)} hint="(likes+comments+shares) ÷ views" />
        <Stat label="Share rate" value={pct(a.totals.shareRate, 2)} hint="shares ÷ views — key for reach" />
        <Stat
          label="Posts / week"
          value={a.totals.postsPerWeek.toFixed(1)}
          hint={a.totals.daysSinceLastPost !== null ? `last post ${a.totals.daysSinceLastPost}d ago` : undefined}
        />
      </div>

      <Card title="What to do next" subtitle={`Based on ${a.scoredCount} videos older than ${MATURE_DAYS} days, each compared with videos you posted around the same time.`}>
        {a.insights.length ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {a.insights.map((ins) => {
              const s = INSIGHT_STYLE[ins.kind];
              return (
                <li key={ins.title} className="flex gap-3 rounded-lg border border-line p-3">
                  <span
                    aria-label={s.label}
                    className="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ background: s.color }}
                  >
                    {s.icon}
                  </span>
                  <div>
                    <div className="text-sm font-medium">{ins.title}</div>
                    <p className="mt-0.5 text-sm text-ink-2">{ins.detail}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted">No strong patterns yet — keep posting and check back.</p>
        )}
      </Card>

      <Card title="Views per video" subtitle={`Last ${recent.length} videos, oldest → newest. Faded = less than ${MATURE_DAYS} days old, still collecting views.`}>
        <ColumnChart
          reference={usual}
          referenceLabel={usual ? `typical ${compact(usual)}` : undefined}
          data={recent.map((v) => ({
            key: v.id,
            value: v.views,
            faded: !v.mature,
            tip: (
              <>
                <div className="line-clamp-2 font-medium">{caption(v)}</div>
                <div className="mt-1 text-muted">{shortDate(v.createdAt, timeZone)} · {v.duration}s</div>
                <div className="tabular mt-1">
                  {v.views.toLocaleString("en")} views{v.index !== null && ` · ${times(v.index)} usual`}
                </div>
                <div className="tabular text-muted">
                  {pct(v.engagementRate)} engagement · {v.shares.toLocaleString("en")} shares
                </div>
              </>
            ),
          }))}
        />
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card
          className="lg:col-span-2"
          title="When to post"
          subtitle="Median views vs. your usual, by day and time you posted. 1.5× = 50% more views than typical."
        >
          <Heatmap rows={WEEKDAYS} cols={TIME_BLOCKS} cells={a.heatmap} />
        </Card>
        <Card title="By day" subtitle="More samples per bar than the grid.">
          <IndexBars rows={a.byDay} />
          <div className="mt-5 border-t border-line pt-4">
            <IndexBars rows={a.byBlock} />
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="What to post: topics" subtitle="Edit topic keywords in lib/topics.ts.">
          <IndexBars rows={a.byTopic} />
        </Card>
        <Card title="Hashtags" subtitle="Used on 3+ videos.">
          <IndexBars rows={a.byHashtag.map((h) => ({ ...h, label: `#${h.label}` }))} />
        </Card>
        <Card title="Format & length">
          <IndexBars rows={a.byDuration} />
        </Card>
      </div>

      <Card title="Follower growth" subtitle={connected ? "One snapshot per day you open this dashboard." : "Sample data."}>
        {snapshots.length > 1 ? (
          <LineChart name="Followers" data={snapshots.map((s) => ({ label: s.date, value: s.followers }))} />
        ) : (
          <p className="text-sm text-muted">Started tracking today. TikTok only gives current totals, so come back tomorrow to see a trend.</p>
        )}
      </Card>

      <Card title="All videos" subtitle="Click a column to sort. “vs usual” is the fairest way to compare old and new videos.">
        <VideoTable videos={[...a.videos].reverse()} timeZone={timeZone} />
      </Card>

      <footer className="pb-8 text-xs text-muted">
        TikTok&apos;s public API doesn&apos;t expose watch time, retention, traffic sources, audience demographics or follower
        activity hours. Check those in TikTok Studio → Analytics, especially average watch time on your top videos.
      </footer>
    </main>
  );
}
