import { sessionCookie } from "../../../../../src/server/session.js";
import { safeErrorMessage } from "../../../../../src/server/security.js";
import {
  clearMfaChallengeCookie,
  readMfaChallengeCookie,
  verifyMfaLogin
} from "../../../../../src/server/login-mfa.js";
import { readTrustedBrowserCookie, trustedBrowserCookie } from "../../../../../src/server/email-otp-v2.js";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await verifyMfaLogin({
      rawCookie: readMfaChallengeCookie(request),
      code: body.code,
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
      userAgent: request.headers.get("user-agent"),
      existingBrowserToken: readTrustedBrowserCookie(request)
    });
    if (!result.ok) {
      return Response.json(
        { ok: false, reason: result.reason, attemptsRemaining: result.attemptsRemaining },
        { status: result.status }
      );
    }
    const headers = new Headers();
    headers.append("Set-Cookie", sessionCookie(result.session.token));
    headers.append("Set-Cookie", clearMfaChallengeCookie());
    if (result.trustedToken) headers.append("Set-Cookie", trustedBrowserCookie(result.trustedToken));
    return Response.json({ ok: true, user: result.user, redirectUrl: result.redirectUrl, trustedUntil: result.trustedUntil }, { headers });
  } catch (error) {
    console.error("MFA login verification failed", safeErrorMessage(error));
    return Response.json({ ok: false, reason: "server_error" }, { status: 500 });
  }
}
