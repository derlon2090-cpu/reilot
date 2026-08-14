import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("Google authentication client routing", () => {
  const googleSource = readFileSync("src/app/auth-google.js", "utf8");
  const appSource = readFileSync("src/app/app.js", "utf8");

  it("uses Google Identity Services as the primary account creation flow", () => {
    expect(googleSource).toContain('const GOOGLE_SCRIPT_URL = "https://accounts.google.com/gsi/client"');
    expect(googleSource).toContain('const [clientId, nonce, google] = await Promise.all([requestGoogleConfig(), requestGoogleNonce(), loadGoogleIdentity()])');
    expect(googleSource).toContain("google.accounts.id.initialize({");
    expect(googleSource).toContain("google.accounts.id.renderButton(host");
    expect(googleSource).toContain('body: JSON.stringify({ credential, locale: english ? "en" : "ar", intent })');
    expect(googleSource).not.toContain("use_fedcm_for_prompt");
  });

  it("keeps the authorization-code page as a recovery path only", () => {
    expect(googleSource).toContain('new URL("/api/auth/google/start", baseUrl)');
    expect(googleSource).toContain('fallback.dataset.googleServerFallback = "true"');
    expect(googleSource).toContain("window.location.assign(target)");
  });

  it("keeps the browser on the accounts gateway and retries only explicit warm-up responses", () => {
    expect(googleSource).toContain("const portal = normalizedOrigin(config().authUrl)");
    expect(googleSource).toContain('requestGoogleGateway("/api/auth/google/config")');
    expect(googleSource).toContain('lastReason !== "auth_backend_warming"');
    expect(googleSource).not.toContain('const PRODUCTION_AUTH_API_ORIGIN = "https://api.renvix.app"');
  });

  it("forces fresh Google and Turnstile modules after an authentication deployment", () => {
    expect(appSource).toContain('auth-turnstile.js?v=20260813-auth-routing-v110');
    expect(appSource).toContain('auth-google.js?v=20260814-auth-gateway-v118');
  });

  it("keeps actionable redirect errors and created-account handling", () => {
    expect(appSource).toContain('localizedCopy("الحساب غير موجود", "Account not found")');
    expect(appSource).toContain("payload.created === true");
  });
});
