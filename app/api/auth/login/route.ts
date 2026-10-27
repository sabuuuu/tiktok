import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { STATE_COOKIE } from "@/lib/session";
import { authorizeUrl, isConfigured, onPublicHost, publicUrl } from "@/lib/tiktok";

export async function GET(request: Request) {
  if (!isConfigured()) {
    return Response.redirect(publicUrl("/?error=not-configured", request));
  }
  // The state cookie must be set on the host TikTok redirects back to (e.g. the tunnel, not localhost).
  if (!onPublicHost(request)) {
    return Response.redirect(publicUrl("/api/auth/login", request));
  }
  // CSRF protection: TikTok echoes `state` back to the callback.
  const state = randomBytes(16).toString("hex");
  (await cookies()).set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return Response.redirect(authorizeUrl(state));
}
