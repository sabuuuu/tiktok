import { clearSession, getSession } from "@/lib/session";
import { publicUrl, revoke } from "@/lib/tiktok";

export async function POST(request: Request) {
  const session = await getSession();
  if (session) await revoke(session);
  await clearSession();
  return Response.redirect(publicUrl("/", request), 303);
}
