import "server-only";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { Profile, Snapshot } from "./types";

// The API only returns *current* follower counts, so we keep one snapshot per day locally
// to draw growth over time. Swap this for a database if you deploy somewhere with an
// ephemeral filesystem (e.g. Vercel).
const FILE = path.join(process.cwd(), ".data", "snapshots.json");

export async function recordSnapshot(openId: string, profile: Profile): Promise<Snapshot[]> {
  let all: Record<string, Snapshot[]> = {};
  try {
    all = JSON.parse(await readFile(FILE, "utf8"));
  } catch {}

  const list = all[openId] ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const snap = { date: today, followers: profile.followers, likes: profile.likes, videoCount: profile.videoCount };
  all[openId] = [...list.filter((s) => s.date !== today), snap].sort((a, b) => a.date.localeCompare(b.date));

  try {
    await mkdir(path.dirname(FILE), { recursive: true });
    await writeFile(FILE, JSON.stringify(all, null, 2));
  } catch (err) {
    console.warn("Could not save snapshot:", err);
  }
  return all[openId];
}
