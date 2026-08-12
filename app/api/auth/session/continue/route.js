import { appBaseUrl, authPageUrl } from "../../../../../src/server/app-url.js";
import { getSessionWithToken, sessionCookie } from "../../../../../src/server/session.js";
import { safeReturnTo } from "../../../../../src/shared/auth-portal.js";

export async function GET(req) {
  const returnTo = safeReturnTo(new URL(req.url).searchParams.get("returnTo"));
  const resolved = await getSessionWithToken(req).catch(() => null);
  if (!resolved?.session || !resolved.token) {
    return Response.redirect(authPageUrl("/login", returnTo), 302);
  }

  const remainingSeconds = Math.max(0, Math.floor((new Date(resolved.session.expiresAt).getTime() - Date.now()) / 1000));
  if (!remainingSeconds) return Response.redirect(authPageUrl("/login", returnTo), 302);

  const headers = new Headers({
    Location: new URL(returnTo, appBaseUrl()).toString(),
    "Cache-Control": "no-store",
    "Set-Cookie": sessionCookie(resolved.token, remainingSeconds)
  });
  return new Response(null, { status: 302, headers });
}
