import { adminSessionCookie, sessionCookie } from "../../../../../src/server/session.js";
import { safeErrorMessage } from "../../../../../src/server/security.js";
import {
  clearAdminChallengeCookie,
  clearChallengeCookie,
  readEmailOtpChallengeCookie,
  readTrustedBrowserCookie,
  trustedDeviceCookie,
  verifyEmailOtp
} from "../../../../../src/server/email-otp-v2.js";
import { recordSecuritySignal } from "../../../../../src/server/security-center.js";

export async function POST(req) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return Response.json({ ok: false, reason: "invalid_request" }, { status: 400 });
    }
    const challenge = readEmailOtpChallengeCookie(req);
    const result = await verifyEmailOtp({
      rawCookie: challenge.value,
      code: body.code,
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
      userAgent: req.headers.get("user-agent"),
      existingBrowserToken: readTrustedBrowserCookie(req)
    });
    if (!result.ok) {
      if (challenge.admin) await recordSecuritySignal({
        eventType: "ADMIN_MFA_FAILED",
        sourceIp: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
        requestedPath: "/admin/email-otp",
        metadata: { reason: result.reason, attemptsRemaining: result.attemptsRemaining }
      });
      return Response.json(
        { ok: false, reason: result.reason, attemptsRemaining: result.attemptsRemaining },
        { status: result.status }
      );
    }
    const headers = new Headers();
    const adminSession = result.redirectUrl === "/admin";
    headers.append("Set-Cookie", adminSession
      ? adminSessionCookie(result.session.token, result.sessionCookieMaxAge)
      : sessionCookie(result.session.token, result.sessionCookieMaxAge));
    headers.append("Set-Cookie", adminSession || challenge.admin ? clearAdminChallengeCookie() : clearChallengeCookie());
    if (result.trustedToken) headers.append("Set-Cookie", trustedDeviceCookie(result.trustedToken));
    return Response.json({ ok: true, user: result.user, redirectUrl: result.redirectUrl, trustedUntil: result.trustedUntil }, { headers });
  } catch (error) {
    console.error("email OTP verification failed", safeErrorMessage(error));
    return Response.json({ ok: false, reason: "server_error" }, { status: 500 });
  }
}
