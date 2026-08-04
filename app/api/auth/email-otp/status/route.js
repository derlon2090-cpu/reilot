import {
  EMAIL_OTP_CHALLENGE_COOKIE,
  clearChallengeCookie,
  getEmailOtpStatus,
  readCookie
} from "../../../../../src/server/email-otp-v2.js";

export async function GET(req) {
  try {
    const result = await getEmailOtpStatus(readCookie(req, EMAIL_OTP_CHALLENGE_COOKIE));
    if (!result.ok) {
      return Response.json(
        { ok: false, reason: result.reason },
        { status: 401, headers: { "Set-Cookie": clearChallengeCookie() } }
      );
    }
    return Response.json(result);
  } catch {
    return Response.json({ ok: false, reason: "server_error" }, { status: 500 });
  }
}
