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
    expect(appSource).toContain("function authReferenceVisual");
    expect(appSource).toContain("function authDashboardScene");
    expect(appSource).toContain('class="auth-platform-scene"');
    expect(appSource).toContain('class="auth-platform-monitor"');
    expect(appSource).toContain('class="auth-platform-phone"');
    expect(appSource).toContain('class="auth-platform-feature auth-platform-feature--security"');
    expect(appSource).toContain('class="auth-suite-scene auth-suite-scene--${kind}"');
    expect(appSource).toContain('kind === "signupOtp" ? signupOtpScene');
    expect(appSource).toContain('kind === "loginOtp" ? loginOtpScene');
    expect(appSource).toContain('scene: "loginOtp"');
    expect(appSource).toContain('scene: "signupOtp"');
    expect(appSource).not.toContain('class="auth-showcase-caption"');
    expect(appSource).toContain('class="auth-showcase-feature-connectors"');
    expect(appSource).toContain('auth-feature-connector--alerts');
    expect(appSource).toContain('kind === "login" || kind === "register"');
    expect(appSource).toContain('class="auth-showcase-reference-art"');
    expect(appSource).toContain("function prioritizeAuthReference");
    expect(appSource).toContain('loading="eager" decoding="sync" fetchpriority="high"');
    expect(appSource).toContain('width="1127" height="1038"');
    for (const asset of ["dashboard-v2.png", "mfa-v2.png", "reset-v2.png", "login-otp-v2.png", "signup-otp-v2.png"]) {
      expect(appSource).toContain(`/app/assets/auth-reference/${asset}`);
      expect(fs.existsSync(path.join(root, "public/app/assets/auth-reference", asset))).toBe(true);
    }
    expect(appSource).toContain('viewBox="12 7 486 305"');
    for (const referenceContent of ["تذكيرات ذكية", "تقارير وتحليلات", "أتمتة التجديدات", "حملات مخصصة", "أمان وموثوقية", "1,250", "45,680", "98%", "تم تجديد اشتراكك بنجاح"]) {
      expect(appSource).toContain(referenceContent);
    }
    expect(stylesSource).toContain(".auth-platform-scene::before");
    expect(stylesSource).toContain("border:1px dashed rgba(17,127,115,.26)");
    expect(stylesSource).toContain("height:100dvh!important");
    expect(stylesSource).toContain("height:100svh!important");
    expect(stylesSource).toContain(".auth-showcase-caption");
    expect(stylesSource).toContain("place-items:center!important");
    expect(stylesSource).toContain("align-self:center!important");
    expect(stylesSource).toContain("transform:scale(1.065)");
    expect(stylesSource).toContain("transform-origin:center center!important");
    expect(stylesSource).toContain("transform:translate(-50%,-50%) scale(.58)!important");
    expect(stylesSource).toContain("Final auth flow correction: reference order, visible tabs and register-only scrolling.");
    expect(stylesSource).toContain("flex:0 0 54px!important");
    expect(stylesSource).toContain("body:has(.auth-suite-shell.register)");
    expect(stylesSource).toContain("overflow-y:auto!important");
    expect(stylesSource).toContain(".auth-suite-page .auth-suite-otp>.email-otp-panel{\n    grid-column:1!important");
    expect(stylesSource).toContain(".auth-suite-page .auth-suite-otp>.auth-suite-email-visual{\n    grid-column:2!important");
    expect(stylesSource).toContain("-webkit-text-fill-color:#183a36!important");
    expect(stylesSource).toContain(".auth-showcase-dots,.auth-showcase-pagination{display:none!important}");
    expect(stylesSource).toContain(".auth-suite-shell>.auth-suite-visual");
    expect(stylesSource).toContain("Reference-derived artwork: keep mobile untouched and preserve approved panel sizes.");
    expect(stylesSource).toContain(".auth-showcase-reference-art{display:none}");
    expect(stylesSource).toContain(".auth-showcase-art>.auth-showcase-reference-art");
    expect(stylesSource).toContain("object-fit:contain!important");
    expect(stylesSource).toContain("Clean artwork balance: the reference asset owns its precisely attached connector paths.");
    expect(stylesSource).toContain("Keep every reference illustration fully visible inside the approved fixed panel.");
    expect(stylesSource).toContain("Stable access artwork: one panel size for sign-in/register, using embedded connectors.");
    expect(stylesSource).toContain("Preserve the original artwork quality; connectors are a separate layer behind it.");
    expect(stylesSource).toContain(".auth-showcase--login .auth-showcase-feature-connectors");
    expect(stylesSource).toContain(".auth-feature-connector--security");
    expect(stylesSource).toContain("z-index:4;");
    expect(stylesSource).not.toContain(".auth-feature-connector::before");
    expect(stylesSource).toContain(".auth-feature-connector--alerts{top:8.86%;left:13.04%;width:7.66%;transform:rotate(25.4deg)}");
    expect(stylesSource).toContain(".auth-feature-connector--reports{top:9.83%;left:88.64%;width:12.1%;transform:rotate(166deg)}");
    expect(stylesSource).toContain(".auth-feature-connector--automation{top:37.1%;left:10.56%;width:10.2%;transform:rotate(-26.3deg)}");
    expect(stylesSource).toContain(".auth-feature-connector--campaigns{top:70.91%;left:10.38%;width:11.1%;transform:rotate(-32.5deg)}");
    expect(stylesSource).toContain(".auth-feature-connector--channels{top:88%;left:38.4%;width:7.5%;transform:rotate(-51deg);display:none}");
    expect(stylesSource).toContain(".auth-feature-connector--security{top:88.05%;left:73.4%;width:8.5%;transform:rotate(-143.5deg);display:none}");
    expect(stylesSource).toContain(".auth-relocated-feature--channels{top:41%;left:95%");
    expect(stylesSource).toContain(".auth-relocated-feature--security{top:76%;left:95%");
    expect(appSource).not.toContain("auth-relocated-mask");
    expect(stylesSource).not.toContain(".auth-relocated-mask");
    expect(stylesSource).toContain("clip-path:polygon(0 0,100% 0,100% 100%,92% 100%,92% 83%,25% 83%,25% 100%,0 100%)");
    expect(stylesSource).toContain('.auth-relocated-feature>b{font-family:"IBM Plex Sans Arabic","Tajawal",system-ui,sans-serif;font-size:10px;font-weight:600;line-height:1.35;white-space:nowrap}');
    expect(stylesSource).toContain(".auth-relocated-feature>b{font-size:9px}");
    expect(appSource).toContain('class="auth-relocated-connectors"');
    expect(appSource).toContain('x1="892" y1="334" x2="984" y2="384"');
    expect(appSource).toContain('circle cx="892" cy="334" r="4"');
    expect(appSource).toContain('x1="892" y1="671" x2="984" y2="734"');
    expect(appSource).toContain('circle cx="892" cy="671" r="4"');
    expect(stylesSource).toContain(".auth-relocated-connectors line{");
    expect(stylesSource).toContain("stroke-linecap:round;");
    expect(stylesSource).toContain("vector-effect:non-scaling-stroke;");
    expect(stylesSource).toContain(".auth-relocated-connectors circle{fill:currentColor}");
    expect(stylesSource).toContain(".auth-relocated-feature::before{\n    content:none;");
    expect(stylesSource).not.toContain("drop-shadow(0 0 1px rgba(5,101,92,.9))");
    expect(stylesSource).toContain("max-height:330px!important");
  });

  it("prioritizes only the active desktop or tablet authentication artwork before first render", () => {
    for (const source of [layoutSource, staticIndexSource]) {
      expect(source).toContain("(min-width:744px)");
      expect(source).toContain("authReferencePreload");
      expect(source).toContain("fetchPriority='high'");
      for (const asset of ["dashboard-v2.png", "mfa-v2.png", "reset-v2.png", "login-otp-v2.png", "signup-otp-v2.png"]) {
        expect(source).toContain(asset);
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
    expect(appSource).toContain("if (authRoute) state.language = siteLanguage");
    expect(stylesSource).toContain("@media (max-width:820px)");
    expect(stylesSource).toContain(".auth-suite-otp>.email-otp-visual{display:none}");
    expect(stylesSource).toContain('.auth-suite-page[data-auth-theme="dark"] .email-otp-panel');
    expect(stylesSource).toContain('.auth-suite-page[data-auth-theme="dark"] .btn-secondary');
  });

  it("keeps the mobile authentication identity in sync with local display controls", () => {
    expect(appSource).toContain("function authMobileMark");
    expect(appSource).toContain("function authMobileScene");
    expect(appSource).toContain('/assets/renvix-logo-exact.png');
    expect(stylesSource).toContain("/* Final compact authentication presentation */");
    expect(stylesSource).toContain(".auth-mobile-brand");
    expect(stylesSource).toContain(".auth-mobile-scene");
  });
});
