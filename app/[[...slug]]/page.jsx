import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "../../src/server/session.js";
import { authBaseUrl } from "../../src/server/app-url.js";
import { isAuthPath, safeReturnTo } from "../../src/shared/auth-portal.js";

const authTitles = {
  login: "تسجيل الدخول | Renvix",
  register: "إنشاء حساب | Renvix",
  "forgot-password": "استعادة كلمة المرور | Renvix",
  "reset-password": "تعيين كلمة مرور جديدة | Renvix",
  "verify-email": "تحقق من بريدك الإلكتروني | Renvix",
  "verify-mfa": "المصادقة الثنائية | Renvix",
  recovery: "استرداد الوصول | Renvix"
};

export async function generateMetadata({ params }) {
  const { slug = [] } = await params;
  if (slug[0] === "shared" && slug[1] === "document") {
    return { title: "ملف مشترك | Renvix", robots: { index: false, follow: false } };
  }
  if (slug[0] === "shared" && slug[1] === "folder") {
    return { title: "مجلد مشترك | Renvix", robots: { index: false, follow: false } };
  }
  const title = authTitles[slug[0]];
  return title ? { title, robots: { index: false, follow: false } } : {};
}

export default async function SpaPage({ params }) {
  const { slug = [] } = await params;
  const isDashboard = slug[0] === "dashboard";
  const path = `/${slug.join("/")}`;
  const authPath = isAuthPath(path);
  const isLogin = path === "/login";
  const isRegister = path === "/register";

  if (isDashboard || authPath) {
    const requestHeaders = await headers();
    const request = { headers: requestHeaders };
    const session = await getSession(request).catch(() => null);
    if (isDashboard && !session) {
      const login = new URL("/login", authBaseUrl());
      login.searchParams.set("returnTo", safeReturnTo(path));
      redirect(login.toString());
    }
    if (authPath && session && (path === "/login" || path === "/register")) {
      const continuation = new URL("/api/auth/session/continue", authBaseUrl());
      continuation.searchParams.set("returnTo", "/dashboard");
      redirect(continuation.toString());
    }
  }

  return (
    <>
      <div id="app">
        {isLogin || isRegister ? (
          <main className="auth-light-page auth-suite-page auth-renvix" dir="rtl">
            <div className="auth-suite-stage">
              <header className="auth-suite-brandbar">
                <div className="auth-suite-brandbar-logo"><img src="/assets/renvix-logo-primary.png" width="180" height="51" alt="Renvix" /></div>
                <div className="auth-suite-brandbar-controls"><span>العربية</span><span aria-hidden="true">│</span><span>English</span></div>
              </header>
              <section className={`auth-light-shell auth-suite-shell ${isRegister ? "register" : "login"}`}>
                <article className="card auth-light-panel auth-suite-panel">
                  <div className="auth-mobile-brand"><img className="brand-logo-image brand-logo-image--primary" src="/assets/renvix-logo-primary.png" width="180" height="51" alt="Renvix" /></div>
                  <nav className="auth-suite-mode-tabs" aria-label="التسجيل والدخول">
                    <a className={!isRegister ? "active" : ""} href="/login">تسجيل الدخول</a>
                    <a className={isRegister ? "active" : ""} href="/register">إنشاء حساب</a>
                  </nav>
                  <div className="auth-suite-intro"><h1>{isRegister ? "إنشاء حساب" : "أهلًا بعودتك"}</h1><p>{isRegister ? "أنشئ حسابك وابدأ باستخدام Renvix." : "سجّل دخولك إلى حسابك في Renvix لإدارة اشتراكاتك بسهولة."}</p></div>
                  <form className="grid auth-form auth-suite-form">
                    {isRegister && <label className="field"><span>الاسم الكامل</span><input className="input" name="name" autoComplete="name" /></label>}
                    <label className="field"><span>البريد الإلكتروني</span><input className="input" type="email" name="email" autoComplete="email" dir="ltr" placeholder="name@example.com" /></label>
                    <label className="field"><span>كلمة المرور</span><input className="input" type="password" name="password" autoComplete={isRegister ? "new-password" : "current-password"} placeholder="أدخل كلمة المرور" /></label>
                    {!isRegister && <div className="inline-actions split-between"><label className="remember"><input type="checkbox" name="remember" /> تذكرني</label><a href="/forgot-password">نسيت كلمة المرور؟</a></div>}
                    <button className="btn btn-primary auth-submit" type="button" disabled>{isRegister ? "إنشاء الحساب" : "تسجيل الدخول"}</button>
                  </form>
                  <p className="auth-switch">{isRegister ? "لديك حساب بالفعل؟" : "ليس لديك حساب؟"} <a href={isRegister ? "/login" : "/register"}>{isRegister ? "تسجيل الدخول" : "إنشاء حساب"}</a></p>
                </article>
                <aside className="card auth-light-visual auth-suite-visual auth-suite-login-visual" aria-hidden="true" />
              </section>
            </div>
          </main>
        ) : (
          <main className="renvix-entry-shell" dir="rtl" style={{ minHeight: "100svh", width: "100%", maxWidth: "100vw", display: "grid", gridTemplateRows: "auto 1fr", gap: 24, overflowX: "hidden", boxSizing: "border-box", padding: "clamp(20px, 4vw, 48px)", background: "linear-gradient(145deg, #f2f8f7 0%, #fff 54%, #eaf6f3 100%)", color: "#123c38", fontFamily: "var(--font-alexandria), Alexandria, Arial, sans-serif" }}>
            <header style={{ width: "min(1180px, 100%)", justifySelf: "center", display: "flex", alignItems: "center", justifyContent: "flex-start" }}>
              <img src="/assets/renvix-logo-primary.png" width="180" height="51" alt="Renvix" style={{ display: "block", width: "clamp(142px, 18vw, 190px)", maxWidth: "55vw", height: "auto", objectFit: "contain" }} />
            </header>
            <section style={{ width: "min(760px, 100%)", justifySelf: "center", alignSelf: "center", boxSizing: "border-box", padding: "clamp(28px, 6vw, 72px)", border: "1px solid #dcebe7", borderRadius: 28, background: "rgba(255,255,255,.96)", boxShadow: "0 24px 70px rgba(10,81,64,.08)", textAlign: "center" }}>
              <h1 style={{ margin: 0, color: "#123c38", fontSize: "clamp(25px, 4.5vw, 42px)", lineHeight: 1.5 }}>Renvix</h1>
              <p style={{ margin: "12px 0 0", color: "#647b78", fontSize: "clamp(14px, 2vw, 18px)", lineHeight: 1.9 }}>منصة واحدة لإدارة اشتراكاتك وتنمية أعمالك</p>
              <a href="/login" style={{ display: "inline-flex", minHeight: 50, alignItems: "center", justifyContent: "center", boxSizing: "border-box", maxWidth: "100%", marginTop: 28, padding: "0 28px", borderRadius: 12, background: "#075b52", color: "#fff", fontWeight: 700, lineHeight: 1.5, textDecoration: "none" }}>تسجيل الدخول</a>
            </section>
          </main>
        )}
      </div>
      <div id="portal" />
    </>
  );
}
