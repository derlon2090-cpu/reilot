import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const appSource = fs.readFileSync(path.join(root, "src/app/app.js"), "utf8");
const stylesSource = fs.readFileSync(path.join(root, "src/styles/globals.css"), "utf8");
const setupRoute = fs.readFileSync(path.join(root, "app/api/settings/security/mfa/setup/route.js"), "utf8");
const disableRoute = fs.readFileSync(path.join(root, "app/api/settings/security/mfa/disable/route.js"), "utf8");

describe("mobile sidebar and MFA UI contracts", () => {
  it("renders the public navigation as five icon-led links with a focused mobile drawer", () => {
    expect(appSource).toContain('const navIcons = ["publicHome", "publicFeatures", "publicPlans", "publicBlog", "support"]');
    expect(appSource).toContain('class="public-nav-icon"');
    expect(appSource).toContain('dashboardIcon("menu")');
    expect(appSource).toContain('dashboardIcon("close")');
    expect(appSource).toContain('class="public-nav-preferences"');
    expect(appSource).toContain('class="public-auth-actions"');
    expect(appSource).not.toContain('data-link="/partners"');
    expect(stylesSource).toContain("Public navigation: icon-led desktop/tablet bar and focused mobile drawer");
    expect(stylesSource).toContain('grid-template-areas: "brand actions" "links links"');
    expect(stylesSource).toContain('grid-template-areas: "brand menu" "links links" "actions actions"');
    expect(stylesSource).toContain(".public-site .nav-link.active .public-nav-icon");
  });

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
    expect(appSource).toContain('"auth-light-page mfa-login-page"');
    expect(appSource).toContain('function authSuiteFrame');
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

  it("keeps password controls, recovery art, and email OTP sizing aligned with the auth references", () => {
    expect(appSource).toContain('class="auth-recovery-icon"');
    expect(appSource).toContain('function authIntroIcon');
    expect(appSource).toContain('auth-intro-symbol--${kind}');
    expect(appSource).toContain("623 841");
    expect(appSource).toContain("7F3K-R9D2-4M8Q");
    expect(appSource).not.toContain('<ol class="email-otp-steps">');
    expect(stylesSource).toContain("inset-inline:auto;");
    expect(stylesSource).toContain("left:8px;");
    expect(stylesSource).toContain(".auth-suite-shell.register{min-height:640px}");
    expect(stylesSource).toContain(".auth-suite-otp .email-otp-content{width:min(100%,500px)");
  });

  it("renders authentication as a standalone responsive model with isolated display settings", () => {
    const authStart = appSource.indexOf("function authDisplaySettings");
    const authEnd = appSource.indexOf("function normalizeEmailOtpCode", authStart);
    const authPages = appSource.slice(authStart, authEnd);
    expect(authPages).toContain('class="auth-display-settings');
    expect(authPages).toContain('data-action="auth-display-language"');
    expect(authPages).toContain('data-action="auth-display-theme"');
    expect(authPages).toContain('data-auth-language="${language}"');
    expect(authPages).toContain('data-auth-theme="${theme}"');
    expect(authPages).not.toContain("auth-light-header");
    expect(authPages).not.toContain("publicFooter()");
    expect(appSource).toContain('localStorage.setItem("renvix.auth.language"');
    expect(appSource).toContain('localStorage.setItem("renvix.auth.theme"');
    expect(stylesSource).toContain(".auth-display-settings{position:fixed");
    expect(stylesSource).toContain("@media (max-width:820px)");
    expect(stylesSource).toContain(".auth-suite-otp>.email-otp-visual{display:none}");
    expect(stylesSource).toContain(".auth-display-settings{position:absolute;");
  });

  it("keeps the compact display controller and mobile authentication identity in sync", () => {
    expect(appSource).toContain('class="auth-display-close-icon"');
    expect(appSource).toContain('class="auth-display-sliders-icon"');
    expect(appSource).toContain("function authMobileMark");
    expect(appSource).toContain("function authMobileScene");
    expect(appSource).toContain('/assets/renvix-mark.webp');
    expect(stylesSource).toContain("/* Final compact authentication presentation */");
    expect(stylesSource).toContain(".auth-display-settings.is-open .auth-display-trigger");
    expect(stylesSource).toContain(".auth-display-trigger .auth-display-close-icon");
    expect(stylesSource).toContain(".auth-mobile-brand");
    expect(stylesSource).toContain(".auth-mobile-scene");
  });
});
