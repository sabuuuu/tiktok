import { cookies } from "next/headers";
import { saveSession, STATE_COOKIE } from "@/lib/session";
import { exchangeCode, publicUrl } from "@/lib/tiktok";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expected = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  const fail = (reason: string) => Response.redirect(publicUrl(`/?error=${encodeURIComponent(reason)}`, request));

  if (url.searchParams.get("error")) return fail(url.searchParams.get("error_description") ?? "access-denied");
  if (!code || !state || state !== expected) return fail("invalid-state");

  try {
    await saveSession(await exchangeCode(code));
  } catch (err) {
    return fail((err as Error).message);
  }
  return Response.redirect(publicUrl("/", request));
}
