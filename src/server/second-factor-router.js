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
  let browser;
  try {
    browser = await validateTrustedBrowser({ userId: user.id, rawToken: rawBrowserToken, riskDetected });
  } catch (error) {
    // A stale trusted-browser row or a rolling schema mismatch must never
    // block login. Treat the browser as untrusted and require a fresh factor;
    // this degrades to the safer path instead of bypassing verification.
    console.error("trusted browser validation unavailable", {
      code: String(error?.code || "TRUSTED_BROWSER_VALIDATION_ERROR")
    });
    browser = { trusted: false, reason: "validation_unavailable" };
  }
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
