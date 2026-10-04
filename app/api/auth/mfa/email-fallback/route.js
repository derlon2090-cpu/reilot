import { mutationOriginResponse } from "../../../../../src/shared/request-origin.js";
import { safeErrorMessage } from "../../../../../src/server/security.js";
import {
  clearMfaChallengeCookie,
  getMfaEmailFallbackContext,
  readMfaChallengeCookie
} from "../../../../../src/server/login-mfa.js";
import {
  adminChallengeCookie,
  challengeCookie,
  createLoginEmailOtpChallenge
} from "../../../../../src/server/email-otp-v2.js";

export async function POST(request) {
  const originDenied = mutationOriginResponse(request);
  if (originDenied) return originDenied;
  const rawCookie = readMfaChallengeCookie(request);
  try {
    const body = await request.json().catch(() => ({}));
    const context = await getMfaEmailFallbackContext(rawCookie);
    if (!context.ok) {
      return Response.json(
        { ok: false, reason: context.reason },
        { status: context.status, headers: { "Set-Cookie": clearMfaChallengeCookie(), "Cache-Control": "no-store" } }
      );
    }
    const adminLogin = context.targetPath === "/admin";
    const result = await createLoginEmailOtpChallenge({
      user: context.user,
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
      userAgent: request.headers.get("user-agent"),
      locale: body.locale === "en" ? "en" : "ar",
      purpose: adminLogin ? "admin_login" : "login",
      loginAttemptId: context.loginAttemptId,
      sourceMfaChallengeId: context.challengeId
    });
    const headers = new Headers({ "Cache-Control": "no-store" });
    headers.append("Set-Cookie", adminLogin ? adminChallengeCookie(result.challengeCookie) : challengeCookie(result.challengeCookie));
    headers.append("Set-Cookie", clearMfaChallengeCookie());
    return Response.json({
      ok: true,
      requiresEmailOtp: true,
      purpose: adminLogin ? "admin_login" : "login",
      maskedEmail: result.maskedEmail,
      expiresAt: result.expiresAt,
      resendAt: result.resendAt
    }, { status: 202, headers });
  } catch (error) {
    console.error("MFA email fallback failed", safeErrorMessage(error));
    const invalidChallenge = error?.code === "MFA_CHALLENGE_INVALID";
    return Response.json(
      { ok: false, reason: invalidChallenge ? "challenge_invalid" : "email_delivery_failed" },
      {
        status: invalidChallenge ? 401 : 503,
        headers: invalidChallenge
          ? { "Set-Cookie": clearMfaChallengeCookie(), "Cache-Control": "no-store" }
          : { "Cache-Control": "no-store" }
      }
    );
  }
}
