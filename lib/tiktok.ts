import "server-only";
import type { Session } from "./session";
import type { Profile, Video } from "./types";

// TikTok Login Kit + Display API (v2).
// Docs: https://developers.tiktok.com/doc/login-kit-web and https://developers.tiktok.com/doc/display-api-overview
const AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";
const API = "https://open.tiktokapis.com/v2";

export const SCOPES = ["user.info.basic", "user.info.profile", "user.info.stats", "video.list"];

export function isConfigured() {
  return Boolean(
    process.env.TIKTOK_CLIENT_KEY &&
      process.env.TIKTOK_CLIENT_SECRET &&
      process.env.TIKTOK_REDIRECT_URI &&
      process.env.SESSION_SECRET,
  );
}

/**
 * Absolute URL on the app's public origin (taken from TIKTOK_REDIRECT_URI).
 * Behind a tunnel, `request.url` reports the local address (e.g. https://localhost:3007),
 * so redirects must not be built from it.
 */
export function publicUrl(path: string, request: Request) {
  const base = process.env.TIKTOK_REDIRECT_URI ? new URL(process.env.TIKTOK_REDIRECT_URI).origin : request.url;
  return new URL(path, base);
}

/** True when the browser is on the same host TikTok will redirect back to (where the state cookie must live). */
export function onPublicHost(request: Request) {
  if (!process.env.TIKTOK_REDIRECT_URI) return true;
  return request.headers.get("host") === new URL(process.env.TIKTOK_REDIRECT_URI).host;
}

export function authorizeUrl(state: string) {
  const params = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY!,
    scope: SCOPES.join(","),
    response_type: "code",
    redirect_uri: process.env.TIKTOK_REDIRECT_URI!,
    state,
  });
  return `${AUTH_URL}?${params}`;
}

type TokenResponse = {
  access_token: string;
  expires_in: number;
  open_id: string;
  refresh_token: string;
  refresh_expires_in: number;
  error?: string;
  error_description?: string;
};

async function tokenRequest(params: Record<string, string>): Promise<Session> {
  const res = await fetch(`${API}/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      ...params,
    }),
    cache: "no-store",
  });
  const json = (await res.json()) as TokenResponse;
  if (!res.ok || json.error) {
    throw new Error(`TikTok token error: ${json.error_description ?? json.error ?? res.status}`);
  }
  const now = Date.now();
  return {
    openId: json.open_id,
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    accessExpiresAt: now + json.expires_in * 1000,
    refreshExpiresAt: now + json.refresh_expires_in * 1000,
  };
}

export function exchangeCode(code: string) {
  return tokenRequest({
    code,
    grant_type: "authorization_code",
    redirect_uri: process.env.TIKTOK_REDIRECT_URI!,
  });
}

export function refreshSession(session: Session) {
  return tokenRequest({ grant_type: "refresh_token", refresh_token: session.refreshToken });
}

export async function revoke(session: Session) {
  await fetch(`${API}/oauth/revoke/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      token: session.accessToken,
    }),
  }).catch(() => {});
}

type ApiEnvelope<T> = { data: T; error: { code: string; message: string } };

async function api<T>(session: Session, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    // Cache API responses briefly so reloading the dashboard doesn't burn the rate limit.
    next: { revalidate: 300 },
  });
  const json = (await res.json()) as ApiEnvelope<T>;
  if (!res.ok || (json.error && json.error.code !== "ok")) {
    throw new Error(`TikTok API ${path}: ${json.error?.message || res.status}`);
  }
  return json.data;
}

export async function fetchProfile(session: Session): Promise<Profile> {
  const fields = "open_id,avatar_url,display_name,username,follower_count,following_count,likes_count,video_count";
  const { user } = await api<{ user: Record<string, string | number> }>(
    session,
    `/user/info/?fields=${fields}`,
  );
  return {
    displayName: String(user.display_name ?? ""),
    username: String(user.username ?? ""),
    avatarUrl: user.avatar_url ? String(user.avatar_url) : undefined,
    followers: Number(user.follower_count ?? 0),
    following: Number(user.following_count ?? 0),
    likes: Number(user.likes_count ?? 0),
    videoCount: Number(user.video_count ?? 0),
  };
}

type ApiVideo = {
  id: string;
  create_time: number;
  title?: string;
  video_description?: string;
  duration?: number;
  cover_image_url?: string;
  share_url?: string;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
};

export async function fetchVideos(session: Session, limit = 500): Promise<Video[]> {
  const fields =
    "id,create_time,title,video_description,duration,cover_image_url,share_url,view_count,like_count,comment_count,share_count";
  const videos: Video[] = [];
  let cursor: number | undefined;

  // The API pages 20 videos at a time, newest first.
  while (videos.length < limit) {
    const page = await api<{ videos: ApiVideo[]; cursor: number; has_more: boolean }>(
      session,
      `/video/list/?fields=${fields}`,
      { method: "POST", body: JSON.stringify({ max_count: 20, ...(cursor ? { cursor } : {}) }) },
    );
    for (const v of page.videos ?? []) {
      videos.push({
        id: v.id,
        createdAt: v.create_time,
        title: v.title ?? "",
        description: v.video_description ?? "",
        duration: v.duration ?? 0,
        coverUrl: v.cover_image_url,
        shareUrl: v.share_url,
        views: v.view_count ?? 0,
        likes: v.like_count ?? 0,
        comments: v.comment_count ?? 0,
        shares: v.share_count ?? 0,
      });
    }
    if (!page.has_more || !page.videos?.length) break;
    cursor = page.cursor;
  }
  return videos;
}
