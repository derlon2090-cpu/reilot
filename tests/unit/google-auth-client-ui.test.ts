import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("Google authentication client intent", () => {
  const googleSource = readFileSync("src/app/auth-google.js", "utf8");
  const appSource = readFileSync("src/app/app.js", "utf8");

  it("sends a distinct login or registration intent to every Google flow", () => {
    expect(googleSource).toContain('function intentFor(host)');
    expect(googleSource).toContain('body: JSON.stringify({ credential, locale: english ? "en" : "ar", intent })');
    expect(googleSource).toContain('target.searchParams.set("intent", intentFor(host))');
    expect(googleSource).toContain('text: intentFor(host) === "register" ? "signup_with" : "signin_with"');
  });

  it("renews the one-time nonce after a failed Google attempt", () => {
    expect(googleSource).toContain('delete host.dataset.googleMounted');
    expect(googleSource).toContain('queueMicrotask(() => { void mountGoogleButton(host); })');
    expect(googleSource).toContain('const [google, nonce] = await Promise.all([loadGoogleIdentity(), requestNonce()])');
  });

  it("shows an actionable missing-account message instead of a generic failure", () => {
    expect(googleSource).toContain('google_account_not_found:');
    expect(appSource).toContain('localizedCopy("الحساب غير موجود", "Account not found")');
    expect(appSource).toContain('payload.created === true');
  });
});
