import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const appSource = fs.readFileSync(path.join(root, "src/app/app.js"), "utf8");
const stylesSource = fs.readFileSync(path.join(root, "src/styles/globals.css"), "utf8");
const setupRoute = fs.readFileSync(path.join(root, "app/api/settings/security/mfa/setup/route.js"), "utf8");
const disableRoute = fs.readFileSync(path.join(root, "app/api/settings/security/mfa/disable/route.js"), "utf8");

describe("mobile sidebar and MFA UI contracts", () => {
  it("closes the mobile sidebar through a real outside backdrop", () => {
    expect(appSource).toContain('class="sidebar-backdrop" data-action="close-sidebar"');
    expect(appSource).toContain('action === "close-sidebar"');
    expect(stylesSource).toContain(".sidebar-backdrop");
    expect(stylesSource).toContain("z-index: 44");
  });

  it("keeps the MFA switch tied to persisted server state", () => {
    const settingsStart = appSource.indexOf("function settingsPage");
    const settingsEnd = appSource.indexOf("function settingToggle", settingsStart);
    const settingsPage = appSource.slice(settingsStart, settingsEnd);
    expect(settingsPage).toContain("if (state.accountSettings === null)");
    expect(settingsPage.indexOf("if (state.accountSettings === null)")).toBeLessThan(settingsPage.indexOf("const remote = state.accountSettings.settings"));
    expect(settingsPage).not.toContain("state.dashboardOverview?.profile");
    expect(settingsPage).toContain("settings-loading-grid");
    expect(appSource).toContain("const enabled = Boolean(state.accountSettings?.settings?.mfaEnabled)");
    expect(appSource).toContain("target.checked = enabled");
    expect(appSource).toContain("state.mfaSetupPending = true");
    expect(appSource).toContain('method: "DELETE"');
    expect(setupRoute).toContain("mfa_pending_secret_encrypted = NULL");
    expect(setupRoute).toContain("AND mfa_enabled = false");
    expect(setupRoute).toContain("verifyPassword(body.currentPassword");
    expect(appSource).toContain('data-submit="mfa-setup-start"');
  });

  it("requires both the current password and an OTP or recovery code before disabling OTP", () => {
    expect(disableRoute).toContain("passwordValid && (otpValid || recoveryValid)");
    expect(disableRoute).toContain("UPDATE auth_mfa_login_challenges");
    expect(disableRoute).toContain("DELETE FROM sessions WHERE user_id = $1 AND id <> $2");
    expect(appSource).toContain("كلمة المرور الحالية ورمز OTP أو أحد رموز الاسترداد");
  });

  it("uses the supplied original Zid artwork without redrawing the mark", () => {
    expect(appSource).toContain('<img src="/assets/zid-logo-original.webp" alt="شعار زد الأصلي">');
    expect(appSource).not.toContain('<text x="24" y="31" text-anchor="middle">زد</text>');
    expect(stylesSource).toContain(".integration-logo--zid img");
    expect(fs.existsSync(path.join(root, "public/assets/zid-logo-original.webp"))).toBe(true);
  });

  it("includes a dedicated server-backed MFA login step", () => {
    expect(appSource).toContain('"/auth/verify-mfa": mfaLoginPage');
    expect(appSource).toContain('fetch("/api/auth/mfa/verify"');
    expect(appSource).toContain("payload?.requiresMfa === true");
  });

  it("keeps the MFA challenge balanced at iPad landscape and portrait sizes", () => {
    expect(appSource).toContain('class="auth-light-page mfa-login-page auth-suite-page"');
    expect(appSource).toContain('class="reset-light-shell mfa-login-shell auth-suite-shell auth-suite-mfa"');
    expect(appSource).toContain('class="card reset-light-panel mfa-login-panel auth-suite-panel"');
    expect(appSource).toContain('class="card reset-light-visual mfa-login-visual auth-suite-visual auth-suite-mfa-visual"');
    expect(stylesSource).toContain(".auth-suite-mfa");
    expect(stylesSource).toContain("@media (min-width: 941px) and (max-width: 1366px) and (pointer: coarse)");
    expect(stylesSource).toContain("grid-template-columns: repeat(2, minmax(0, 1fr));");
    expect(stylesSource).toContain("min-height: calc(100dvh - 204px);");
    expect(stylesSource).toContain("@media (min-width: 641px) and (max-width: 940px) and (pointer: coarse)");
  });

  it("keeps every public authentication form paired with its own responsive illustration", () => {
    for (const kind of ["login", "register", "emailOtp", "mfa", "reset"]) {
      expect(appSource).toContain(`authScene("${kind}")`);
    }
    expect(appSource).toContain('class="auth-suite-scene auth-suite-scene--${kind}"');
    expect(appSource).toContain("فعّل حسابك بثقة");
    expect(appSource).toContain("حالة التفعيل");
    expect(appSource).toContain("authFeatureStrip()");
    expect(stylesSource).toContain(".auth-suite-feature-strip");
    expect(stylesSource).toContain(".auth-suite-scene");
    expect(stylesSource).toContain(".auth-suite-shell>.auth-suite-visual");
  });
});
