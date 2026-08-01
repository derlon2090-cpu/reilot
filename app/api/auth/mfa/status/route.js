import {
  clearMfaChallengeCookie,
  getMfaLoginStatus,
  readMfaChallengeCookie
} from "../../../../../src/server/login-mfa.js";

export async function GET(request) {
  try {
    const result = await getMfaLoginStatus(readMfaChallengeCookie(request));
    if (!result.ok) {
      return Response.json(result, {
        status: 401,
        headers: { "Set-Cookie": clearMfaChallengeCookie() }
      });
    }
    return Response.json(result);
  } catch {
    return Response.json({ ok: false, reason: "server_error" }, { status: 500 });
  }
}
