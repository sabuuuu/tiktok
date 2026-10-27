import { clearSession, getSession, saveSession } from "@/lib/session";
import { publicUrl, refreshSession } from "@/lib/tiktok";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return Response.redirect(publicUrl("/", request));
  try {
    await saveSession(await refreshSession(session));
    return Response.redirect(publicUrl("/", request));
  } catch (err) {
    await clearSession();
    return Response.redirect(publicUrl(`/?error=${encodeURIComponent((err as Error).message)}`, request));
  }
}
