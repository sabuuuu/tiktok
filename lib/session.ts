import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "tt_session";
export const STATE_COOKIE = "tt_oauth_state";

export type Session = {
  openId: string;
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: number; // ms
  refreshExpiresAt: number; // ms
};

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set (32+ characters). See .env.example");
  }
  return createHash("sha256").update(secret).digest();
}

// AES-256-GCM so tokens are never readable or forgeable from the browser.
export function seal(data: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(data), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

export function unseal<T>(value: string): T | null {
  try {
    const raw = Buffer.from(value, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const body = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]);
    return JSON.parse(body.toString("utf8")) as T;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!value || !process.env.SESSION_SECRET) return null;
  const session = unseal<Session>(value);
  if (!session || session.refreshExpiresAt < Date.now()) return null;
  return session;
}

export async function saveSession(session: Session) {
  (await cookies()).set(SESSION_COOKIE, seal(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor((session.refreshExpiresAt - Date.now()) / 1000),
  });
}

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}
