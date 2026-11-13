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

function PublicHomeFirstPaint() {
  return (
    <div className="page-shell public-site renvix-first-paint">
      <nav className="public-nav" aria-label="التنقل الرئيسي">
        <div className="container nav-inner">
          <a className="brand btn-ghost" href="/" aria-label="Renvix">
            <img className="brand-logo-image brand-logo-image--primary" src="/assets/renvix-logo-primary.png" width="814" height="228" alt="Renvix" />
          </a>
          <div className="nav-links">
            <a className="nav-link active" href="/" aria-current="page">الرئيسية</a>
            <a className="nav-link" href="/features">المميزات</a>
            <a className="nav-link" href="/pricing">الباقات</a>
            <a className="nav-link" href="/blog">المدونة</a>
            <a className="nav-link" href="/support">الدعم</a>
          </div>
          <div className="nav-actions">
            <div className="public-nav-preferences"><button className="public-language-compact" type="button"><strong>English</strong></button></div>
            <div className="public-auth-actions">
              <a className="btn btn-secondary public-login-action" href="/login">تسجيل الدخول</a>
              <a className="btn btn-primary public-register-action" href="/register">إنشاء حساب</a>
            </div>
          </div>
          <a href="/register" className="mobile-public-login">إنشاء حساب</a>
          <button className="mobile-menu" type="button" aria-label="فتح القائمة">☰</button>
        </div>
      </nav>
      <main className="marketing-v3 renvix-home">
        <section className="home-hero">
          <div className="container home-hero-grid">
            <div className="home-hero-copy is-visible" data-reveal>
              <span className="home-hero-badge"><i />منصة ذكية لإدارة الاشتراكات والتجديدات</span>
              <h1>أدر اشتراكات عملائك<br />وجدّدها بذكاء مع <em>Renvix</em></h1>
              <p>منصة متكاملة تساعدك على إدارة الاشتراكات، أتمتة التنبيهات، التواصل عبر واتساب والبريد، وتحليل الأداء لتنمو أعمالك بثقة واستدامة.</p>
              <div className="home-hero-actions">
                <a href="/register" className="btn btn-primary">ابدأ مجانًا الآن</a>
                <a href="/features" className="btn btn-secondary">استكشف المميزات</a>
              </div>
              <div className="home-hero-trust"><span>✓ تجربة مجانية 14 يومًا</span><span>✓ لا بطاقة ائتمانية مطلوبة</span><span>✓ إعداد سريع خلال دقائق</span></div>
            </div>
            <div className="home-hero-visual is-visible" data-reveal>
              <article className="home-first-paint-preview" aria-label="معاينة لوحة تحكم Renvix">
                <img src="/assets/dashboard-preview.webp" width="838" height="360" alt="معاينة لوحة تحكم Renvix" />
              </article>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

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
  const isHome = path === "/";

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
        ) : isHome ? <PublicHomeFirstPaint /> : null}
      </div>
      <div id="portal" />
    </>
  );
}
