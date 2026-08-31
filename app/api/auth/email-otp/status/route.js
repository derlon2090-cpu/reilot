import {
  clearAdminChallengeCookie,
  clearChallengeCookie,
  getEmailOtpStatus,
  readEmailOtpChallengeCookie
} from "../../../../../src/server/email-otp-v2.js";

export async function GET(req) {
  try {
    const challenge = readEmailOtpChallengeCookie(req);
    const result = await getEmailOtpStatus(challenge.value);
    if (!result.ok) {
      return Response.json(
        { ok: false, reason: result.reason },
        { status: 401, headers: { "Set-Cookie": challenge.admin ? clearAdminChallengeCookie() : clearChallengeCookie() } }
      );
    }
    return Response.json(result);
  } catch {
    return Response.json({ ok: false, reason: "server_error" }, { status: 500 });
  }
}
