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

  it("repairs the historical admin-login purpose constraint without depending on a rewritten migration", async () => {
    const migration = await readFile(new URL("../../drizzle/0061_auth_challenge_purpose_repair.sql", import.meta.url), "utf8");
    const email = await readFile(new URL("../../src/server/email-otp-v2.js", import.meta.url), "utf8");
    expect(migration).toContain("admin_login");
    expect(migration).toContain("DROP CONSTRAINT");
    expect(email).toContain('purpose === "admin_login" ? "login" : purpose');
    expect(email).toContain('signChallengeId(challenge.id, purpose === "admin_login" ? "admin_login" : "login")');
  });

  it("supports global platform administrators without inventing a customer tenant", async () => {
    const migration = await readFile(new URL("../../drizzle/0062_platform_admin_auth_challenges.sql", import.meta.url), "utf8");
    expect(migration).toContain("auth_email_otp_challenges");
    expect(migration).toContain("auth_mfa_login_challenges");
    expect(migration).toContain("auth_trusted_devices");
    expect(migration.match(/ALTER COLUMN tenant_id DROP NOT NULL/g)).toHaveLength(3);
  });

  it("keeps one UI per factor and directs successful TOTP straight to the dashboard", async () => {
    const source = await readFile(new URL("../../src/app/app.js", import.meta.url), "utf8");
    const mfaPage = source.slice(source.indexOf("function mfaLoginPage"), source.indexOf("async function loadMfaLoginStatus"));
    expect(mfaPage).toContain("أدخل رمز تطبيق المصادقة");
    expect(mfaPage).toContain("auth-suite-mfa");
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
