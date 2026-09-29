import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const appSource = fs.readFileSync(path.join(root, "src/app/app.js"), "utf8").replace(/\r\n/g, "\n");
const stylesSource = fs.readFileSync(path.join(root, "src/styles/globals.css"), "utf8").replace(/\r\n/g, "\n");
const layoutSource = fs.readFileSync(path.join(root, "app/layout.jsx"), "utf8");
const staticIndexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
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
    expect(stylesSource).toContain("Public navigation uses an icon-led active pill without an underline");
    expect(stylesSource).toContain("background: #F3F8F7 !important;");
    expect(stylesSource).toContain("min-height: 50px;");
    expect(stylesSource).toContain("border-radius: 14px !important;");
  });

  it("closes the mobile sidebar through a real outside backdrop", () => {
    expect(appSource).toContain('class="sidebar-backdrop" data-action="close-sidebar"');
    expect(appSource).toContain('class="sidebar-drawer-close" data-action="close-sidebar"');
    expect(appSource).toContain('action === "close-sidebar"');
    expect(stylesSource).toContain(".sidebar-backdrop");
    expect(stylesSource).toContain("z-index: 44");
  });

  it("keeps Renvix Center on the same persistent iPad sidebar layout as Storage Center", () => {
    expect(stylesSource).toContain("inherit the same persistent dashboard sidebar as Storage Center.");
    expect(stylesSource).toContain("@media (max-width: 1366px)");
    expect(stylesSource).not.toContain(".dashboard-shell:has(.rvx-support-suite) > .sidebar-backdrop");
    expect(stylesSource).not.toContain(".dashboard-shell:has(.rvx-support-suite) .mobile-side-toggle");
    expect(stylesSource).toContain("grid-template-columns: 284px minmax(0, 1fr)");
    expect(stylesSource).toMatch(/\.dashboard-shell > \.sidebar \{\s*position: sticky;/);
    expect(appSource).toContain('document.querySelector(".dashboard-shell > .sidebar")?.classList.remove("open")');
    expect(appSource).toContain('document.querySelector(".sidebar-backdrop")?.remove()');
  });

  it("keeps the MFA switch tied to persisted server state", () => {
    const settingsStart = appSource.indexOf("function settingsPage");
    const settingsEnd = appSource.indexOf("function notificationSettingToggle", settingsStart);
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
    expect(appSource).toContain('"/verify-mfa": mfaLoginPage');
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
    expect(appSource).toContain("function authScene");
    expect(appSource).toContain("function authReferenceVisual");
    expect(appSource).toContain("function authBrandIllustration");
    expect(appSource).toContain('class="auth-suite-scene auth-suite-scene--${kind}"');
    expect(appSource).toContain('kind === "signupOtp" ? signupOtpScene');
    expect(appSource).toContain('kind === "loginOtp" ? loginOtpScene');
    expect(appSource).toContain('authReferenceVisual(isRegister ? "register" : "login")');
    expect(appSource).toContain('authReferenceVisual(signupVerification ? "signupOtp" : "loginOtp")');
    expect(appSource).toContain('authReferenceVisual("reset")');
    expect(appSource).toContain('authReferenceVisual("mfa")');
    expect(appSource).toContain('viewBox="12 7 486 305"');
    expect(stylesSource).toContain(".auth-suite-scene");
    expect(stylesSource).toContain(".auth-suite-shell>.auth-suite-visual");
    expect(stylesSource).toContain("height:100dvh!important");
    expect(stylesSource).toContain("height:100svh!important");
    expect(stylesSource).toContain("body:has(.auth-suite-shell.register)");
    expect(stylesSource).toContain("overflow-y:auto!important");
  });
  it("loads desktop auth CSS without preloading obsolete bitmap references", () => {
    for (const source of [layoutSource, staticIndexSource]) {
      expect(source).toContain("(min-width: 768px)");
      expect(source).toContain("/app/styles/auth-renvix.css?v=");
      expect(source).not.toContain("authReferencePreload");
      for (const asset of ["dashboard-v2.png", "mfa-v2.png", "reset-v2.png", "login-otp-v2.png", "signup-otp-v2.png"]) {
        expect(source).not.toContain(asset);
      }
    }
    expect(layoutSource).toContain('<Script type="module" src="/app/app.js?v=');
  });

  it("keeps password controls, recovery art, and email OTP sizing aligned with the auth references", () => {
    expect(appSource).toContain('class="auth-recovery-icon"');
    expect(appSource).toContain('function authIntroIcon');
    expect(appSource).toContain('auth-intro-symbol--${kind}');
    expect(appSource).toContain("746 823");
    expect(appSource).toContain("رموز الاسترداد");
    expect(appSource).toContain("7F3K-R9D2-4M8Q");
    expect(appSource).not.toContain('<ol class="email-otp-steps">');
    expect(stylesSource).toContain("inset-inline:auto;");
    expect(stylesSource).toContain("left:8px;");
    expect(stylesSource).toContain(".auth-suite-shell.register{min-height:640px}");
    expect(stylesSource).toContain(".auth-suite-otp .email-otp-content{width:min(100%,500px)");
  });

  it("keeps authentication language and theme independent from dashboard preferences", () => {
    const authStart = appSource.indexOf("function authSuiteFrame");
    const authEnd = appSource.indexOf("function normalizeEmailOtpCode", authStart);
    const authPages = appSource.slice(authStart, authEnd);
    expect(authPages).toContain('const language = state.authDisplayLanguage === "en"');
    expect(authPages).toContain('const theme = state.authDisplayTheme === "dark"');
    expect(authPages).toContain('data-auth-language="${language}"');
    expect(authPages).toContain('data-auth-theme="${theme}"');
    expect(authPages).toContain('class="auth-suite-brandbar-controls"');
    expect(authPages).toContain('data-action="auth-display-language" data-language="ar"');
    expect(authPages).toContain('data-action="auth-display-language" data-language="en"');
    expect(authPages).toContain('data-action="auth-display-theme"');
    expect(authPages).not.toContain("authDisplaySettings");
    expect(authPages).not.toContain("auth-light-header");
    expect(authPages).not.toContain("publicFooter()");
    expect(appSource).toContain('readAuthDisplayPreference("language", "ar"');
    expect(appSource).toContain('readAuthDisplayPreference("theme", "light"');
    expect(appSource).toContain('localStorage.setItem("renvix.auth.language"');
    expect(appSource).toContain('localStorage.setItem("renvix.auth.theme"');
    expect(appSource).toContain("if (authRoute) state.language = state.authDisplayLanguage");
    expect(appSource).toContain("document.documentElement.lang = state.authDisplayLanguage");
    expect(appSource).toContain(
      'document.documentElement.dir = state.authDisplayLanguage === "ar" ? "rtl" : "ltr"',
    );
    expect(appSource).toContain("state.language = siteLanguage;");
    expect(stylesSource).toContain("@media (max-width:820px)");
    expect(stylesSource).toContain(".auth-suite-otp>.email-otp-visual{display:none}");
    expect(stylesSource).toContain('.auth-suite-page[data-auth-theme="dark"] .email-otp-panel');
    expect(stylesSource).toContain('.auth-suite-page[data-auth-theme="dark"] .btn-secondary');
  });

  it("keeps the mobile authentication identity in sync with local display controls", () => {
    expect(appSource).toContain("function authMobileMark");
    expect(appSource).toContain("function authMobileScene");
    expect(appSource).toContain('/assets/renvix-logo-primary.png');
    expect(stylesSource).toContain("/* Final compact authentication presentation */");
    expect(stylesSource).toContain(".auth-mobile-brand");
    expect(stylesSource).toContain(".auth-mobile-scene");
  });
});
