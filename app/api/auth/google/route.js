import { authenticateGoogle, clearGoogleNonceCookie, readGoogleNonceDigest, verifyGoogleCredential } from "../../../../src/server/google-auth.js";
import { sessionCookie } from "../../../../src/server/session.js";
import { challengeCookie, readTrustedBrowserCookie } from "../../../../src/server/email-otp-v2.js";
import { mfaChallengeCookie } from "../../../../src/server/login-mfa.js";

function allowedOrigins() {
  return new Set([process.env.APP_URL, process.env.NEXT_PUBLIC_APP_URL, process.env.AUTH_URL, process.env.BETTER_AUTH_URL, "http://localhost:3000"]
    .filter(Boolean).map((value) => { try { return new URL(value).origin; } catch { return ""; } }).filter(Boolean));
}

function corsHeaders(req) {
  const origin = req.headers.get("origin");
  if (!origin || !allowedOrigins().has(origin)) return {};
  return { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true", Vary: "Origin" };
}

function appendCookies(headers, cookies) {
  cookies.filter(Boolean).forEach((cookie) => headers.append("Set-Cookie", cookie));
  return headers;
}

export async function POST(req) {
  const origin = req.headers.get("origin");
  if (origin && !allowedOrigins().has(origin)) return Response.json({ ok: false, reason: "origin_not_allowed" }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  const verified = await verifyGoogleCredential({ credential: body.credential, expectedNonceDigest: readGoogleNonceDigest(req) });
  const baseHeaders = new Headers({ ...corsHeaders(req), "Cache-Control": "no-store" });
  baseHeaders.append("Set-Cookie", clearGoogleNonceCookie());
  if (!verified.ok) return Response.json({ ok: false, reason: verified.reason }, { status: verified.status, headers: baseHeaders });
  try {
    const result = await authenticateGoogle({
      profile: verified.profile,
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
      userAgent: req.headers.get("user-agent"),
      trustedDeviceToken: readTrustedBrowserCookie(req),
      locale: body.locale === "en" ? "en" : "ar"
    });
    if (!result.ok) return Response.json({ ok: false, reason: result.reason }, { status: result.status, headers: baseHeaders });
    if (result.requiresMfa) {
      appendCookies(baseHeaders, [mfaChallengeCookie(result.challenge.challengeCookie)]);
      return Response.json({ ok: true, requiresMfa: true, expiresAt: result.challenge.expiresAt, attemptsRemaining: 5, user: result.user }, { status: 202, headers: baseHeaders });
    }
    if (result.requiresEmailOtp) {
      appendCookies(baseHeaders, [challengeCookie(result.challenge.challengeCookie)]);
      return Response.json({ ok: true, requiresEmailOtp: true, maskedEmail: result.challenge.maskedEmail, expiresAt: result.challenge.expiresAt, resendAt: result.challenge.resendAt, user: result.user }, { status: 202, headers: baseHeaders });
    }
    appendCookies(baseHeaders, [sessionCookie(result.session.token)]);
    return Response.json({ ok: true, user: result.user }, { status: result.status, headers: baseHeaders });
  } catch (error) {
    console.error("google authentication failed", { code: String(error?.code || "GOOGLE_AUTH_ERROR") });
    return Response.json({ ok: false, reason: "google_auth_unavailable" }, { status: 503, headers: baseHeaders });
  }
}

export async function OPTIONS(req) {
  const origin = req.headers.get("origin");
  if (!origin || !allowedOrigins().has(origin)) return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: { ...corsHeaders(req), "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS" } });
}
