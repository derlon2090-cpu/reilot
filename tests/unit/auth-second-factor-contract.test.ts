import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("unified second-factor contract", () => {
  it("migrates existing accounts as verified without losing them", async () => {
    const migration = await readFile(new URL("../../drizzle/0060_email_otp_pending_and_trusted_browsers.sql", import.meta.url), "utf8");
    expect(migration).toContain("auth_pending_registrations");
    expect(migration).toContain("email_verified = true");
    expect(migration).toContain("auth_trusted_devices_user_token_idx");
    expect(migration).toContain("ON auth_trusted_devices(user_id, token_digest)");
    expect(migration).toContain("login_attempt_id");
  });

  it("keeps one UI per factor and directs successful TOTP straight to the dashboard", async () => {
    const source = await readFile(new URL("../../src/app/app.js", import.meta.url), "utf8");
    const mfaPage = source.slice(source.indexOf("function mfaLoginPage"), source.indexOf("async function loadMfaLoginStatus"));
    expect(mfaPage).toContain("التحقق بخطوتين");
    expect(mfaPage).toContain("استخدام رمز استرداد");
    expect(mfaPage).not.toContain("إعادة إرسال الرمز");
    expect(source).toContain('if (!await enterDashboardAfterSessionVerification())');
    expect(source).toContain('window.location.replace("/admin")');
  });

  it("invalidates the opposite challenge type before creating a login challenge", async () => {
    const mfa = await readFile(new URL("../../src/server/login-mfa.js", import.meta.url), "utf8");
    const email = await readFile(new URL("../../src/server/email-otp-v2.js", import.meta.url), "utf8");
    expect(mfa).toContain("UPDATE auth_email_otp_challenges SET invalidated_at=now()");
    expect(email).toContain("UPDATE auth_mfa_login_challenges SET invalidated_at=now()");
  });
});
