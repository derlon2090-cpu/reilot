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
          <main className="renvix-entry-shell" dir="rtl">
            <header><img src="/assets/renvix-logo-primary.png" width="180" height="51" alt="Renvix" /></header>
            <section><h1>Renvix</h1><p>منصة واحدة لإدارة اشتراكاتك وتنمية أعمالك</p><a href="/login">تسجيل الدخول</a></section>
          </main>
        )}
      </div>
      <div id="portal" />
    </>
  );
}
