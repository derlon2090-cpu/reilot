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

  it("uses the managed responsive interaction-only widget", () => {
    expect(componentSource).toContain('appearance: "interaction-only"');
    expect(componentSource).toContain('size: "flexible"');
    expect(componentSource).toContain('theme: page?.dataset.authTheme');
    expect(componentSource).toContain("scriptPromise = undefined");
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

  it("keeps the approved Renvix logo asset and readable auth text in dark mode", () => {
    expect(stylesSource).toContain('content:url("/assets/renvix-logo-exact.png")!important');
    expect(stylesSource).toContain("filter:brightness(0) invert(1)!important");
    expect(stylesSource).toContain("color:#f8fbfb!important");
    expect(stylesSource).toContain(".auth-suite-page[data-auth-theme=\"dark\"] .policy-check button");
  });
});
