import { clearSessionCookie, destroySession } from "../../../../src/server/session.js";
import { clearChallengeCookie } from "../../../../src/server/email-otp-v2.js";
import { clearMfaChallengeCookie } from "../../../../src/server/login-mfa.js";

export async function POST(req) {
  await destroySession(req).catch(() => undefined);
  const headers = new Headers();
  headers.append("Set-Cookie", clearSessionCookie());
  headers.append("Set-Cookie", clearChallengeCookie());
  headers.append("Set-Cookie", clearMfaChallengeCookie());
  return Response.json({ ok: true }, { headers });
}
