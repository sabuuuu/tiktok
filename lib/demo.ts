import type { DashboardData, Snapshot, Video } from "./types";

// Deterministic fake channel so the dashboard is explorable before TikTok API access is approved.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const IDEAS: { text: string; boost: number }[] = [
  { text: "I asked AI to refactor my code and this happened #ai #coding #programming", boost: 1.9 },
  { text: "Claude vs ChatGPT for writing tests #ai #llm #devtok", boost: 1.6 },
  { text: "What a junior dev interview actually looks like #career #interview #techjobs", boost: 2.1 },
  { text: "How I got hired without a CS degree #career #learntocode", boost: 1.8 },
  { text: "My salary as a developer in 2026 #career #salary #devtok", boost: 2.4 },
  { text: "POV: it works on my machine #pov #programmerhumor #coding", boost: 1.3 },
  { text: "When the PM says 'quick change' #relatable #programmerhumor", boost: 1.2 },
  { text: "useEffect explained in 30 seconds #react #javascript #tutorial", boost: 1.0 },
  { text: "Stop doing this in React #react #nextjs #tips", boost: 1.1 },
  { text: "JavaScript array methods you should know #javascript #tutorial #learntocode", boost: 0.9 },
  { text: "TypeScript generics finally make sense #typescript #ts #tips", boost: 0.7 },
  { text: "Python one-liners that feel illegal #python #tips #coding", boost: 1.0 },
  { text: "Centering a div in 2026 #css #frontend #tutorial", boost: 0.6 },
  { text: "Tailwind tricks nobody talks about #tailwind #css #ui", boost: 0.65 },
  { text: "My VS Code setup for max productivity #vscode #setup #productivity", boost: 0.8 },
  { text: "Desk tour of a remote developer #desk #setup", boost: 0.9 },
  { text: "Git commands I use every day #git #terminal #tutorial", boost: 0.75 },
];

// Weekday (0 = Sun, per Date.getDay) and hour effects baked into the fake data.
const DAY_EFFECT = [0.85, 0.9, 1.15, 1.2, 1.05, 0.9, 0.8];
const hourEffect = (h: number) => (h >= 17 && h <= 21 ? 1.35 : h >= 12 && h < 17 ? 1.0 : h < 8 ? 0.6 : 0.85);
const durationEffect = (d: number) => (d < 15 ? 0.8 : d < 60 ? 1.2 : d < 180 ? 0.95 : 0.7);

export function demoData(): DashboardData {
  const rand = rng(42);
  const now = Math.floor(Date.now() / 1000);
  const videos: Video[] = [];
  const count = 85;

  for (let i = 0; i < count; i++) {
    const daysAgo = Math.round(((count - i) / count) * 210 + rand() * 2);
    const hour = [8, 12, 13, 18, 19, 20, 21, 22, 7, 17][Math.floor(rand() * 10)];
    const date = new Date((now - daysAgo * 86400) * 1000);
    date.setHours(hour, Math.floor(rand() * 60), 0, 0);
    const createdAt = Math.floor(date.getTime() / 1000);

    const idea = IDEAS[Math.floor(rand() * IDEAS.length)];
    const duration = Math.round([9, 22, 34, 45, 58, 75, 120, 200][Math.floor(rand() * 8)] + rand() * 6);
    const growth = 1 + (i / count) * 2.5; // the channel grows over time
    const age = Math.min(1, (now - createdAt) / (86400 * 7)); // young videos are still collecting views
    const luck = Math.exp((rand() - 0.5) * 1.6);
    const views = Math.round(
      2200 * growth * idea.boost * DAY_EFFECT[date.getDay()] * hourEffect(hour) * durationEffect(duration) * luck * (0.3 + 0.7 * age),
    );
    const engagement = 0.05 + rand() * 0.06;

    videos.push({
      id: `demo-${i}`,
      createdAt,
      title: "",
      description: idea.text,
      duration,
      views,
      likes: Math.round(views * engagement),
      comments: Math.round(views * engagement * (idea.text.includes("#career") ? 0.12 : 0.05)),
      shares: Math.round(views * engagement * (idea.boost > 1.4 ? 0.18 : 0.07) * rand() * 2),
    });
  }

  const snapshots: Snapshot[] = [];
  for (let d = 60; d >= 0; d--) {
    const date = new Date((now - d * 86400) * 1000).toISOString().slice(0, 10);
    const followers = Math.round(8400 + (60 - d) * 55 + Math.sin(d / 3) * 90);
    snapshots.push({ date, followers, likes: followers * 21, videoCount: count - Math.floor(d / 2.5) });
  }
  const latest = snapshots.at(-1)!;

  return {
    source: "demo",
    profile: {
      displayName: "Demo Dev",
      username: "demo.dev",
      followers: latest.followers,
      following: 180,
      likes: latest.likes,
      videoCount: count,
    },
    videos,
    snapshots,
  };
}
