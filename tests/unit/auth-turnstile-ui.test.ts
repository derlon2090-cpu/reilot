import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("authentication Turnstile UI integration", () => {
  const appSource = readFileSync("src/app/app.js", "utf8");
  const componentSource = readFileSync("src/app/auth-turnstile.js", "utf8");
  const stylesSource = readFileSync("src/styles/globals.css", "utf8");

  it("protects the four credential forms with distinct actions", () => {
    expect(componentSource).toContain('login: "login"');
    expect(componentSource).toContain('register: "register"');
    expect(componentSource).toContain('forgot: "forgot_password"');
    expect(componentSource).toContain('"reset-password": "reset_password"');
  });

  it("keeps the managed responsive widget visible and recovers without an endless retry loop", () => {
    expect(componentSource).toContain('appearance: "always"');
    expect(componentSource).toContain('size: "flexible"');
    expect(componentSource).toContain('theme: page?.dataset.authTheme');
    expect(componentSource).toContain('retry: "never"');
    expect(componentSource).toContain("AUTOMATIC_RETRY_DELAYS");
    expect(componentSource).toContain("retryableError(code)");
    expect(componentSource).toContain('"refresh-expired": "auto"');
    expect(componentSource).toContain("scriptPromise = undefined");
    expect(componentSource).toContain('"error-callback"(errorCode)');
    expect(componentSource).toContain("return true");
    expect(componentSource).toContain('errorCode: "script-load"');
    expect(componentSource).toContain('<div class="auth-turnstile-widget" data-turnstile-widget></div>');
    expect(componentSource).toContain("data-turnstile-retry");
    expect(componentSource).not.toContain('<div class="auth-turnstile-status"');
    expect(stylesSource).toContain('.auth-turnstile-slot{border:0;background:transparent}');
    expect(stylesSource).toContain('.auth-turnstile-slot[data-turnstile-status="error"] .auth-turnstile-widget{display:none;min-height:0}');
    expect(stylesSource).toContain(".auth-turnstile-retry[hidden]{display:none!important}");
  });

  it("does not add a default widget to email OTP or MFA forms", () => {
    expect(componentSource).not.toContain('"email-otp"');
    expect(componentSource).not.toContain('"mfa-login"');
    expect(appSource).toContain('if (authRoute) void AuthTurnstile.mountAll(app)');
  });

  it("never exposes the server secret in browser code", () => {
    expect(componentSource).not.toContain("TURNSTILE_SECRET_KEY");
    expect(appSource).not.toContain("TURNSTILE_SECRET_KEY");
  });

  it("keeps mobile authentication pages naturally scrollable", () => {
    expect(stylesSource).toContain('body:has(.auth-suite-page){');
    expect(stylesSource).toContain('overflow-y:auto!important');
    expect(stylesSource).toContain('overscroll-behavior-y:auto!important');
  });

  it("keeps the approved Renvix logo asset and readable auth text in dark mode", () => {
    expect(stylesSource).toContain('content:url("/assets/renvix-logo-exact.png")!important');
    expect(stylesSource).toContain("filter:brightness(0) invert(1)!important");
    expect(stylesSource).toContain("color:#f8fbfb!important");
    expect(stylesSource).toContain(".auth-suite-page[data-auth-theme=\"dark\"] .policy-check button");
  });
});
