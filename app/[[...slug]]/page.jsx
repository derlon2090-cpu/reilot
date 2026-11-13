import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "../../src/server/session.js";
import { authBaseUrl } from "../../src/server/app-url.js";
import { isAuthPath, safeReturnTo } from "../../src/shared/auth-portal.js";
import { getActivePlanCatalog } from "../../src/server/plan-catalog.js";

const authTitles = {
  login: "تسجيل الدخول | Renvix",
  register: "إنشاء حساب | Renvix",
  "forgot-password": "استعادة كلمة المرور | Renvix",
  "reset-password": "تعيين كلمة مرور جديدة | Renvix",
  "verify-email": "تحقق من بريدك الإلكتروني | Renvix",
  "verify-mfa": "المصادقة الثنائية | Renvix",
  recovery: "استرداد الوصول | Renvix"
};

const homeFeatures = [
  ["إدارة الاشتراكات", "نظّم الاشتراكات ومواعيد التجديد وبيانات العملاء من مساحة عمل واحدة.", "اشتراكات"],
  ["تنبيهات التجديد", "أتمت التنبيهات في الوقت المناسب وقلّل حالات الانقطاع أو التأخر.", "تنبيهات"],
  ["واتساب والبريد", "تواصل عبر القناة الأنسب بقوالب احترافية ورسائل قابلة للقياس.", "تواصل"],
  ["الحملات", "ابنِ حملات موجهة لشرائح عملائك وتابع أثرها بوضوح.", "حملات"],
  ["التقارير والتحليلات", "حوّل بيانات التجديد والتواصل إلى مؤشرات تساعدك على اتخاذ القرار.", "تقارير"],
  ["روابط معلومات الطلب", "شارك تفاصيل الطلب والتجديد عبر روابط آمنة بهوية متجرك.", "روابط"]
];

const homeJourney = [
  ["إنشاء الحساب", "سجّل حسابك وأضف بيانات نشاطك بخطوات بسيطة."],
  ["الربط والتكامل", "اربط واتساب والبريد ومتجرك بالقنوات التي تحتاجها."],
  ["التخصيص", "اضبط القوالب والتنبيهات ومواعيد رحلة التجديد."],
  ["البدء والنمو", "شغّل الأتمتة وراقب النتائج وحسّن أداء فريقك."]
];

const homeBrands = [
  ["Advanced Pro", "/assets/brands/advanced-pro.png"],
  ["Axion", "/assets/brands/axion.png"],
  ["Upload", "/assets/brands/upload.png"],
  ["Adovix", "/assets/brands/adovix.png"],
  ["Blontix", "/assets/brands/blontix.png"],
  ["ملم", "/assets/brands/mlm.png"],
  ["الرعد للاتصالات", "/assets/brands/alraad-telecom.jpg"]
];

function FirstPaintIcon({ type = "feature" }) {
  return (
    <svg className="line-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {type === "check" ? <path d="m5 12 4 4L19 6" /> : <><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M8 15v-3m4 3V9m4 6v-6" /></>}
    </svg>
  );
}

function HomeFirstPaintSections({ plans }) {
  const brandItems = (duplicate = false) => homeBrands.map(([name, image]) => (
    <div className="home-brand-item" role="listitem" aria-hidden={duplicate || undefined} key={`${duplicate ? "copy" : "brand"}-${name}`}>
      <img src={image} width="112" height="42" alt={duplicate ? "" : name} loading="lazy" decoding="async" />
    </div>
  ));
  return (
    <>
      <section className="home-brands" aria-labelledby="home-brands-title"><div className="container">
        <h2 id="home-brands-title">يستخدم Renvix مع جهات موثوقة</h2>
        <div className="trusted-brands-marquee"><div className="home-brands-viewport"><div className="home-brands-track"><div className="trusted-brands-set" role="list">{brandItems()}</div><div className="trusted-brands-set" aria-hidden="true">{brandItems(true)}</div></div></div></div>
      </div></section>
      <section className="home-section home-features" id="features"><div className="container">
        <header className="home-section-heading is-visible" data-reveal><span>منصة واحدة، تشغيل أوضح</span><h2>كل ما تحتاجه لإدارة اشتراكاتك بذكاء</h2><p>أدوات مترابطة تساعد فريقك من أول اشتراك حتى اكتمال التجديد.</p></header>
        <div className="home-feature-grid">{homeFeatures.map(([title, body, label]) => <article className="is-visible" data-reveal key={title}><span title={label}><FirstPaintIcon /></span><h3>{title}</h3><p>{body}</p></article>)}</div>
      </div></section>
      <section className="home-section home-journey" aria-labelledby="home-journey-title"><div className="container">
        <header className="home-section-heading is-visible" data-reveal><span>ابدأ بلا تعقيد</span><h2 id="home-journey-title">رحلة بسيطة لبدء العمل</h2><p>من إنشاء الحساب إلى تشغيل أول رحلة تجديد في أربع خطوات واضحة.</p></header>
        <div className="home-journey-grid">{homeJourney.map(([title, body], index) => <article className="is-visible" data-reveal key={title}><b>{String(index + 1).padStart(2, "0")}</b><span><FirstPaintIcon /></span><h3>{title}</h3><p>{body}</p>{index < homeJourney.length - 1 && <i aria-hidden="true"><em /></i>}</article>)}</div>
      </div></section>
      <section className="home-section home-pricing" id="pricing"><div className="container">
        <header className="home-section-heading is-visible" data-reveal><span>خطط مرنة</span><h2>اختر الباقة المناسبة لنمو أعمالك</h2><p>ابدأ بما يناسب فريقك، وطوّر حدودك عندما يتوسع عملك.</p></header>
        <div className="home-pricing-cards"><div className="grid grid-4">{plans.map((plan) => {
          const price = plan.monthlyPriceSar;
          return <article className={`card pricing-card ${plan.popular ? "featured" : ""}`} key={plan.slug}>
            <span className={`badge ${plan.popular ? "popular" : "available"}`}>{plan.popular ? "الأكثر شيوعًا" : "متاحة"}</span>
            <div className="plan-card-identity"><span className="plan-desktop-icon"><FirstPaintIcon /></span><div><h3>{plan.name}</h3><p>{plan.description}</p></div></div>
            <div className="price">{plan.contactSales ? <><strong>سعر مخصص</strong><small>حلول وحدود حسب احتياج شركتك</small></> : <><strong>{Number(price || 0).toLocaleString("ar-SA")}</strong><small> ريال / شهريًا</small></>}</div>
            <ul className="plan-feature-list">{plan.features.slice(0, 6).map((feature) => <li className="included" key={feature}><FirstPaintIcon type="check" /><span>{feature}</span></li>)}</ul>
            <a className={`btn ${plan.popular ? "btn-primary" : "btn-secondary"}`} href={plan.contactSales ? "/contact" : `/register?plan=${encodeURIComponent(plan.slug)}`}>{plan.contactSales ? "تواصل معنا" : "اختر الباقة"}</a>
          </article>;
        })}</div></div>
        <a href="/pricing" className="home-text-link">قارن جميع تفاصيل الباقات</a>
      </div></section>
    </>
  );
}

function PublicFirstPaintFooter() {
  return <footer className="public-footer marketing-footer"><div className="container marketing-footer-grid">
    <section className="marketing-footer-brand"><a className="brand" href="/"><img className="brand-logo-image brand-logo-image--primary" src="/assets/renvix-logo-primary.png" width="814" height="228" alt="Renvix" /></a><p>منصة سعودية تساعدك على إدارة اشتراكاتك وتجديداتك بذكاء، والتكامل مع قنوات التواصل لتعزيز أعمالك.</p></section>
    <nav className="marketing-footer-column" aria-label="المنتج"><h2>المنتج</h2><a href="/features">المميزات</a><a href="/pricing">الباقات</a><a href="/integrations">التكاملات</a><a href="/product-updates">تحديثات المنتج</a></nav>
    <nav className="marketing-footer-column" aria-label="الشركة"><h2>الشركة</h2><a href="/about">من نحن</a><a href="/careers">الوظائف</a><a href="/partners">الشركاء</a><a href="/contact">تواصل معنا</a></nav>
    <nav className="marketing-footer-column" aria-label="الموارد"><h2>الموارد</h2><a href="/blog">المدونة</a><a href="/user-guide">دليل المستخدم</a><a href="/faq">الأسئلة الشائعة</a><a href="/message-templates">قوالب الرسائل</a></nav>
    <section className="marketing-footer-newsletter"><h2>اشترك في نشرتنا البريدية</h2><p>احصل على آخر التحديثات والنصائح والعروض الحصرية لتنمية اشتراكاتك.</p></section>
  </div><div className="container marketing-footer-bottom"><span>©2026 Renvix. جميع الحقوق محفوظة.</span><nav aria-label="السياسات القانونية"><a href="/terms">الشروط والأحكام</a><a href="/privacy">سياسة الخصوصية</a></nav></div></footer>;
}

function PublicHomeFirstPaint({ plans = [] }) {
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
        <HomeFirstPaintSections plans={plans} />
      </main>
      <PublicFirstPaintFooter />
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
  const homePlans = isHome ? await getActivePlanCatalog().catch(() => []) : [];

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
        ) : isHome ? <PublicHomeFirstPaint plans={homePlans} /> : null}
      </div>
      <div id="portal" />
    </>
  );
}
