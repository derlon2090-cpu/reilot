const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export const TURNSTILE_ACTIONS = Object.freeze({
  login: "login",
  register: "register",
  forgotPassword: "forgot_password",
  resetPassword: "reset_password",
  resendEmailOtp: "resend_email_otp",
  resendMfa: "resend_mfa"
});

function expectedHostname(env) {
  if (env.TURNSTILE_EXPECTED_HOSTNAME) return env.TURNSTILE_EXPECTED_HOSTNAME.trim().toLowerCase();
  if (env.AUTH_URL) {
    try { return new URL(env.AUTH_URL).hostname.toLowerCase(); } catch { /* handled below */ }
  }
  return env.NODE_ENV === "production" ? "accounts.renvix.app" : "";
}

function cloudflareClientIp(request) {
  return request?.headers?.get?.("cf-connecting-ip")?.trim() || "";
}

function logDiagnostic(payload, env) {
  if (env.TURNSTILE_DIAGNOSTICS_ENABLED !== "true") return;
  console.info("[Renvix Turnstile]", {
    success: payload?.success === true,
    errorCodes: Array.isArray(payload?.["error-codes"]) ? payload["error-codes"] : [],
    hostname: String(payload?.hostname || ""),
    action: String(payload?.action || "")
  });
}

export async function verifyTurnstileToken({ token, expectedAction, request, env = process.env, fetchImpl = fetch }) {
  const secret = String(env.TURNSTILE_SECRET_KEY || "").trim();
  // Every environment fails closed. Automated tests use Cloudflare's official
  // test keys, while local development must opt in with its own configured key.
  if (!secret) return { ok: false, reason: "configuration_error" };

  const responseToken = String(token || "").trim();
  if (!responseToken) return { ok: false, reason: "missing_token" };
  if (!expectedAction) return { ok: false, reason: "invalid_action" };

  const form = new URLSearchParams({ secret, response: responseToken });
  const remoteIp = cloudflareClientIp(request);
  if (remoteIp) form.set("remoteip", remoteIp);

  let payload;
  try {
    const response = await fetchImpl(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      cache: "no-store"
    });
    if (!response.ok) return { ok: false, reason: "verification_unavailable" };
    payload = await response.json();
  } catch {
    return { ok: false, reason: "verification_unavailable" };
  }

  logDiagnostic(payload, env);

  if (payload?.success !== true) return { ok: false, reason: "challenge_failed" };
  if (String(payload.action || "") !== expectedAction) return { ok: false, reason: "action_mismatch" };

  const hostname = expectedHostname(env);
  if (hostname && String(payload.hostname || "").toLowerCase() !== hostname) {
    return { ok: false, reason: "hostname_mismatch" };
  }

  return { ok: true };
}

export function turnstileFailureResponse(result) {
  const status = result?.reason === "verification_unavailable" || result?.reason === "configuration_error" ? 503 : 400;
  return Response.json({ ok: false, reason: "turnstile_failed" }, { status });
}
