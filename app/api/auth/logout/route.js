import { mutationOriginResponse } from "../../../../src/shared/request-origin.js";
import { clearSessionCookie, destroySession } from "../../../../src/server/session.js";
import { clearChallengeCookie } from "../../../../src/server/email-otp-v2.js";
import { clearMfaChallengeCookie } from "../../../../src/server/login-mfa.js";

export async function POST(req) {
  const originDenied = mutationOriginResponse(req);
  if (originDenied) return originDenied;
  let sessionRevoked = true;
  try {
    await destroySession(req);
  } catch {
    sessionRevoked = false;
  }
  const headers = new Headers();
  // Older deployments may have issued this cookie as host-only before the
  // shared AUTH_COOKIE_DOMAIN setting was configured. Clear both variants.
  headers.append("Set-Cookie", clearSessionCookie({ hostOnly: true }));
  headers.append("Set-Cookie", clearSessionCookie());
  headers.append("Set-Cookie", clearChallengeCookie());
  headers.append("Set-Cookie", clearMfaChallengeCookie());
  headers.set("Cache-Control", "no-store");
  return Response.json({ ok: true, sessionRevoked }, { headers });
}
