import "server-only";
import { connection } from "next/server";
import { demoData } from "./demo";
import { getSession } from "./session";
import { recordSnapshot } from "./snapshots";
import { fetchProfile, fetchVideos } from "./tiktok";
import type { DashboardData } from "./types";

export type LoadResult =
  | { status: "ok"; data: DashboardData }
  | { status: "needs-refresh" }
  | { status: "error"; message: string; data: DashboardData };

export async function loadDashboard(forceDemo: boolean): Promise<LoadResult> {
  // Everything here depends on the current time and the visitor's session.
  await connection();
  const session = forceDemo ? null : await getSession();
  if (!session) return { status: "ok", data: demoData() };
  // Access tokens last 24h; the refresh route renews them (cookies can't be set during render).
  if (session.accessExpiresAt < Date.now() + 60_000) return { status: "needs-refresh" };

  try {
    const [profile, videos] = await Promise.all([fetchProfile(session), fetchVideos(session)]);
    const snapshots = await recordSnapshot(session.openId, profile);
    return { status: "ok", data: { source: "tiktok", profile, videos, snapshots } };
  } catch (err) {
    return { status: "error", message: (err as Error).message, data: demoData() };
  }
}
