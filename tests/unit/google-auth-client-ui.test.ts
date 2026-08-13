import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("Google authentication client routing", () => {
  const googleSource = readFileSync("src/app/auth-google.js", "utf8");
  const appSource = readFileSync("src/app/app.js", "utf8");

  it("uses a native clickable button that opens the backend-owned OAuth flow", () => {
    expect(googleSource).toContain('new URL("/api/auth/google/start", baseUrl)');
    expect(googleSource).toContain('target.searchParams.set("intent", intentFor(host))');
    expect(googleSource).toContain('button.dataset.googleOAuth = "true"');
    expect(googleSource).toContain("window.location.assign(target)");
    expect(googleSource).not.toContain("renderButton");
    expect(googleSource).not.toContain("use_fedcm_for_prompt");
  });

  it("keeps a safe production backend fallback when stale frontend configuration is cached", () => {
    expect(googleSource).toContain('const PRODUCTION_AUTH_API_ORIGIN = "https://api.renvix.app"');
    expect(googleSource).toContain('window.location.hostname.endsWith(".renvix.app")');
  });

  it("forces fresh Google and Turnstile modules after an authentication deployment", () => {
    expect(appSource).toContain('auth-turnstile.js?v=20260813-auth-routing-v110');
    expect(appSource).toContain('auth-google.js?v=20260813-auth-routing-v110');
  });

  it("keeps actionable redirect errors and created-account handling", () => {
    expect(appSource).toContain('localizedCopy("الحساب غير موجود", "Account not found")');
    expect(appSource).toContain("payload.created === true");
  });
});
