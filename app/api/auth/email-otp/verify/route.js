import { sessionCookie } from "../../../../../src/server/session.js";
import { safeErrorMessage } from "../../../../../src/server/security.js";
import {
  EMAIL_OTP_CHALLENGE_COOKIE,
  clearChallengeCookie,
  readCookie,
  readTrustedBrowserCookie,
  trustedDeviceCookie,
  verifyEmailOtp
} from "../../../../../src/server/email-otp-v2.js";

export async function POST(req) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return Response.json({ ok: false, reason: "invalid_request" }, { status: 400 });
    }
    const result = await verifyEmailOtp({
      rawCookie: readCookie(req, EMAIL_OTP_CHALLENGE_COOKIE),
      code: body.code,
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
      userAgent: req.headers.get("user-agent"),
      existingBrowserToken: readTrustedBrowserCookie(req)
    });
    if (!result.ok) {
      return Response.json(
        { ok: false, reason: result.reason, attemptsRemaining: result.attemptsRemaining },
        { status: result.status }
      );
    }
    const headers = new Headers();
    headers.append("Set-Cookie", sessionCookie(result.session.token));
    headers.append("Set-Cookie", clearChallengeCookie());
    if (result.trustedToken) headers.append("Set-Cookie", trustedDeviceCookie(result.trustedToken));
    return Response.json({ ok: true, user: result.user, redirectUrl: result.redirectUrl, trustedUntil: result.trustedUntil }, { headers });
  } catch (error) {
    console.error("email OTP verification failed", safeErrorMessage(error));
    return Response.json({ ok: false, reason: "server_error" }, { status: 500 });
  }
}
