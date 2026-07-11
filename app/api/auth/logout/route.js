import { clearSessionCookie, destroySession } from "../../../../src/server/session.js";

export async function POST(req) {
  await destroySession(req).catch(() => undefined);
  return Response.json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie() } });
}
