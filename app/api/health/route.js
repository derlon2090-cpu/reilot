import { databaseHealth } from "../../../src/server/db.js";
import { evolutionHealth } from "../../../src/server/evolution-client.js";
import { safeErrorMessage } from "../../../src/server/security.js";
import { authSchemaHealth } from "../../../src/server/auth-schema-readiness.js";

export async function GET() {
  const policy = {
    secondFactorRequired: process.env.AUTH_SECOND_FACTOR_REQUIRED === "true",
    signupEmailOtpRequired: process.env.EMAIL_SIGNUP_OTP_REQUIRED === "true",
    emailFallbackEnabled: process.env.EMAIL_OTP_FALLBACK_ENABLED === "true",
    trustedBrowserEnabled: process.env.TRUSTED_BROWSER_ENABLED === "true",
    trustedBrowserHours: Number.parseInt(process.env.TRUSTED_BROWSER_HOURS || "0", 10),
    emailOtpEnforceAllDisabled: process.env.EMAIL_OTP_ENFORCE_ALL !== "true"
  };
  const emailOtpRequired = true;
  const otpPepperReady = (process.env.EMAIL_OTP_PEPPER?.trim().length || 0) >= 24;
  const resendReady = Boolean(process.env.RESEND_API_KEY?.trim());
  const authPolicyReady = policy.secondFactorRequired
    && policy.signupEmailOtpRequired
    && policy.emailFallbackEnabled
    && policy.trustedBrowserEnabled
    && policy.trustedBrowserHours === 48
    && policy.emailOtpEnforceAllDisabled;
  const checks = {
    database: { ok: false },
    authSchema: { ok: false },
    authPolicy: { ...policy, ok: authPolicyReady },
    resend: {
      configured: resendReady,
      required: emailOtpRequired,
      ok: !emailOtpRequired || resendReady,
      fromConfigured: true
    },
    emailOtp: { required: emailOtpRequired, pepperConfigured: otpPepperReady, ok: !emailOtpRequired || (resendReady && otpPepperReady) },
    evolution: { configured: Boolean(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY), ok: false }
  };
  try {
    checks.database = await databaseHealth();
    checks.authSchema = await authSchemaHealth();
  } catch (error) {
    checks.database = { ok: false, error: safeErrorMessage(error) };
    checks.authSchema = { ok: false, error: safeErrorMessage(error) };
  }
  if (checks.evolution.configured) {
    try {
      checks.evolution = { configured: true, ...(await evolutionHealth()) };
    } catch (error) {
      checks.evolution = { configured: true, ok: false, error: safeErrorMessage(error) };
    }
  }
  const ok = checks.database.ok && checks.authSchema.ok && checks.authPolicy.ok && checks.emailOtp.ok && (!checks.evolution.configured || checks.evolution.ok);
  return Response.json({
    ok,
    service: "renewpilot-ai",
    database: checks.database.ok ? "connected" : "disconnected",
    evolution: checks.evolution.ok ? "connected" : checks.evolution.configured ? "unavailable" : "not_configured",
    checks,
    timestamp: new Date().toISOString()
  }, { status: ok ? 200 : 503 });
}
