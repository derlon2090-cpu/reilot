import { validateTrustedBrowser } from "./trusted-browser.js";

export function secondFactorRequired() {
  return process.env.AUTH_SECOND_FACTOR_REQUIRED === "true";
}

export function emailOtpFallbackEnabled() {
  return process.env.EMAIL_OTP_FALLBACK_ENABLED === "true"
    || process.env.EMAIL_OTP_ENFORCE_ALL === "true";
}

export async function resolveSecondFactor({ user, rawBrowserToken = "", riskDetected = false }) {
  if (!secondFactorRequired()) {
    return { method: "none", reason: "policy_disabled", requiresChallenge: false };
  }
  const browser = await validateTrustedBrowser({ userId: user.id, rawToken: rawBrowserToken, riskDetected });
  if (browser.trusted) {
    return { method: "trusted_browser", reason: "valid", requiresChallenge: false, browser };
  }
  const totpEnabled = user.mfaEnabled === true && Boolean(user.mfaSecret);
  if (totpEnabled) {
    return { method: "totp", reason: browser.reason, requiresChallenge: true };
  }
  if (emailOtpFallbackEnabled()) {
    return { method: "email_otp", reason: browser.reason, requiresChallenge: true };
  }
  return { method: "unavailable", reason: "email_fallback_disabled", requiresChallenge: true };
}
