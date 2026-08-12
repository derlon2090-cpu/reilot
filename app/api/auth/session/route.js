import { getSessionWithToken, sessionCookie } from "../../../../src/server/session.js";

export async function GET(req) {
  const resolved = await getSessionWithToken(req).catch(() => null);
  if (!resolved?.session) return Response.json({ ok: false, message: "Authentication required" }, { status: 401 });
  const remainingSeconds = Math.max(0, Math.floor((new Date(resolved.session.expiresAt).getTime() - Date.now()) / 1000));
  const headers = new Headers({ "Cache-Control": "no-store" });
  if (resolved.token && remainingSeconds > 0) headers.append("Set-Cookie", sessionCookie(resolved.token, remainingSeconds));
  return Response.json({ ok: true, user: resolved.session }, { headers });
}
