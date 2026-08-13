import { createGoogleNonce, googleClientId, googleNonceCookie, normalizeGoogleAuthIntent } from "../../../../../src/server/google-auth.js";
import { createGoogleOAuthChallenge, googleOAuthAuthorizationUrl, googleOAuthChallengeCookies } from "../../../../../src/server/google-oauth.js";
import { isRenderAuthRuntime, publicAuthApiOrigin } from "../../../../../src/server/auth-backend-runtime.js";

export async function GET(req) {
  const requestUrl = new URL(req.url);
  const intent = normalizeGoogleAuthIntent(requestUrl.searchParams.get("intent"));
  if (!isRenderAuthRuntime()) {
    const backendOrigin = publicAuthApiOrigin();
    if (backendOrigin && backendOrigin !== new URL(req.url).origin) {
      const target = new URL("/api/auth/google/start", backendOrigin);
      target.search = new URL(req.url).search;
      return Response.redirect(target, 307);
    }
    const target = new URL(intent === "register" ? "/register" : "/login", process.env.AUTH_URL || req.url);
    target.searchParams.set("google_error", "auth_backend_required");
    return Response.redirect(target, 302);
  }
  const missingClientId = !googleClientId();
  const missingClientSecret = !String(process.env.GOOGLE_CLIENT_SECRET || "").trim();
  if (missingClientId || missingClientSecret) {
    // Expose only the missing variable name for deployment diagnostics; never its value.
    const target = new URL(intent === "register" ? "/register" : "/login", req.url);
    target.searchParams.set("google_error", "google_backend_not_configured");
    return Response.redirect(target, 302);
  }
  const locale = requestUrl.searchParams.get("locale") === "en" ? "en" : "ar";
  const oauth = createGoogleOAuthChallenge();
  const nonce = createGoogleNonce();
  const headers = new Headers({ Location: googleOAuthAuthorizationUrl({ state: oauth.state, nonce: nonce.nonce, challenge: oauth.challenge, locale }), "Cache-Control": "no-store" });
  [...googleOAuthChallengeCookies(oauth, intent), googleNonceCookie(nonce.digest)].forEach((cookie) => headers.append("Set-Cookie", cookie));
  return new Response(null, { status: 302, headers });
}
