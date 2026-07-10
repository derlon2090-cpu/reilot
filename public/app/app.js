import {
  metrics,
  features,
  pricingPlans,
  subscriptions as seedSubscriptions,
  customers as seedCustomers,
  renewals,
  notifications as seedNotifications,
  warrantyCases as seedWarrantyCases,
  reports,
  knowledgeBase
} from "../data/appData.js";

const app = document.querySelector("#app");
const portal = document.querySelector("#portal");

const storage = {
  get(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
};

const defaultLinkedDevice = {
  status: "not_connected",
  instanceId: "",
  instanceName: "",
  deviceName: "",
  phoneNumber: "",
  pairingCode: "WP-7K4M-9Q2P",
  qrActive: false,
  qrExpiresAt: "",
  lastActivity: "",
  activity: []
};

const state = {
  route: location.pathname,
  query: new URLSearchParams(location.search),
  navOpen: false,
  sidebarOpen: false,
  theme: storage.get("renewpilot.theme", "light"),
  language: storage.get("renewpilot.language", "ar"),
  billing: storage.get("renewpilot.billing", "monthly"),
  filter: "الكل",
  search: "",
  notificationTab: "واتساب",
  subscriptions: storage.get("renewpilot.subscriptions", seedSubscriptions),
  customers: storage.get("renewpilot.customers", seedCustomers),
  notifications: storage.get("renewpilot.notifications", seedNotifications),
  warrantyCases: storage.get("renewpilot.warranty", seedWarrantyCases),
  automation: storage.get("renewpilot.automation", { seven: true, three: true, same: false }),
  settings: storage.get("renewpilot.settings", { whatsapp: true, email: true, sms: false, twoFactor: true, renewAuto: true }),
  linkedDevice: storage.get("renewpilot.linkedDevice", defaultLinkedDevice)
};

const routes = [
  ["/", "الرئيسية"],
  ["/features", "المميزات"],
  ["/pricing", "الأسعار"],
  ["/support", "الدعم"]
];

const dashboardRoutes = [
  ["/dashboard", "الرئيسية", "⌂"],
  ["/dashboard/subscriptions", "الاشتراكات", "ا"],
  ["/dashboard/customers", "العملاء", "ع"],
  ["/dashboard/renewals", "التجديدات", "ت"],
  ["/dashboard/notifications", "التنبيهات", "ن"],
  ["/dashboard/warranty", "المركز الضماني", "ض"],
  ["/dashboard/reports", "التقارير", "ر"],
  ["/dashboard/connected-devices", "الأجهزة المرتبطة", "🔗"],
  ["/dashboard/settings", "الإعدادات", "إ"]
];

function applyPreferences() {
  document.documentElement.dataset.theme = state.theme;
  document.documentElement.lang = state.language;
  document.documentElement.dir = state.language === "ar" ? "rtl" : "ltr";
}

function persistLinkedDevice() {
  storage.set("renewpilot.linkedDevice", state.linkedDevice);
}

function navigate(to) {
  const url = new URL(to, location.origin);
  history.pushState({}, "", url.pathname + url.search);
  state.route = url.pathname;
  state.query = url.searchParams;
  state.navOpen = false;
  state.sidebarOpen = false;
  state.search = "";
  state.filter = "الكل";
  render();
}

function toneClass(value = "") {
  if (["نشط", "تم التجديد", "تم التسليم", "محلولة", "منخفض"].some((x) => value.includes(x))) return "success";
  if (["قريب", "انتظار", "مراجعة", "متوسطة"].some((x) => value.includes(x))) return "warning";
  if (["متأخر", "فشلت", "عالية", "مرتفع"].some((x) => value.includes(x))) return "danger";
  if (["موقوف"].some((x) => value.includes(x))) return "neutral";
  return "info";
}

function status(value) {
  return `<span class="status ${toneClass(value)}">${value}</span>`;
}

function icon(text, tone = "") {
  return `<span class="icon-bubble ${tone}">${text}</span>`;
}

function logo() {
  return `<button class="brand btn-ghost" data-link="/" aria-label="RenewPilot AI">
    <span class="brand-mark">R</span><span>RenewPilot AI</span>
  </button>`;
}

function publicNavbar() {
  const links = routes.map(([path, label]) => `<button class="nav-link ${state.route === path ? "active" : ""}" data-link="${path}">${label}</button>`).join("");
  const themeIcon = state.theme === "dark" ? "☾" : "☀";
  return `<nav class="public-nav ${state.navOpen ? "open" : ""}">
    <div class="container nav-inner">
      ${logo()}
      <div class="nav-links">${links}</div>
      <div class="nav-actions">
        <button class="btn btn-ghost icon-btn" data-action="theme" title="تبديل المظهر">${themeIcon}</button>
        <button class="btn btn-secondary" data-action="language">${state.language.toUpperCase()}</button>
        <button class="btn btn-secondary" data-link="/login">تسجيل الدخول</button>
        <button class="btn btn-primary" data-link="/login">ابدأ الآن</button>
      </div>
      <button class="btn btn-secondary icon-btn mobile-menu" data-action="toggle-public-nav" aria-label="القائمة">☰</button>
    </div>
  </nav>`;
}

function publicShell(content) {
  return `<div class="page-shell">${publicNavbar()}${content}</div>`;
}

function pageHero(title, lead, actions = "") {
  return `<section class="page-hero">
    <div class="container">
      <span class="eyebrow">RenewPilot AI</span>
      <h1>${title}</h1>
      <p class="lead">${lead}</p>
      ${actions ? `<div class="hero-actions center-actions">${actions}</div>` : ""}
    </div>
  </section>`;
}

function statGrid(items) {
  return `<div class="grid grid-5">${items.map((item) => `<article class="card stat-card">
    <div><span class="muted">${item.title}</span><strong>${item.value}</strong><small class="status ${item.tone === "purple" ? "info" : item.tone}">${item.change || "مباشر"}</small></div>
    ${icon(item.title.slice(0, 1), item.tone === "purple" ? "purple" : "")}
  </article>`).join("")}</div>`;
}

function dashboardPreview() {
  return `<article class="card preview-card">
    <div class="preview-header">
      <strong>معاينة لوحة التحكم</strong>
      <div class="dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>
    </div>
    <div class="dashboard-preview">
      <aside class="preview-side">
        <span class="fake-line active"></span><span class="fake-line"></span><span class="fake-line"></span><span class="fake-line"></span><span class="fake-line"></span>
      </aside>
      <main class="preview-main">
        <div class="preview-stats">
          ${["1,256", "86", "324", "184K"].map((value) => `<div class="preview-stat"><span class="muted">مؤشر</span><strong>${value}</strong></div>`).join("")}
        </div>
        <div class="table-skeleton">
          ${Array.from({ length: 6 }).map((_, index) => `<div class="sk-row">
            <span class="fake-line ${index === 0 ? "active" : ""}"></span><span class="fake-line"></span><span class="fake-line"></span><span class="status ${index % 2 ? "success" : "warning"}">${index % 2 ? "نشط" : "قريب"}</span>
          </div>`).join("")}
        </div>
        <div class="bars">${[45, 68, 55, 82, 74, 96].map((h, i) => `<div class="bar" style="height:${h}%"><span>${["س", "ح", "ن", "ث", "ر", "خ"][i]}</span></div>`).join("")}</div>
      </main>
    </div>
  </article>`;
}

function featureGrid(limit = features.length) {
  return `<div class="grid grid-4">${features.slice(0, limit).map(([title, body, mark], index) => `<article class="card feature-card">
    ${icon(mark, index % 4 === 1 ? "purple" : index % 4 === 2 ? "green" : index % 4 === 3 ? "orange" : "")}
    <h3>${title}</h3>
    <p class="muted">${body}</p>
  </article>`).join("")}</div>`;
}

function pricingCards(short = false) {
  return `<div class="grid grid-3">${pricingPlans.map((plan) => {
    const price = state.billing === "yearly" ? plan.yearly : plan.monthly;
    return `<article class="card pricing-card ${plan.featured ? "featured" : ""}">
      ${plan.featured ? `<span class="badge">الأكثر شعبية</span>` : ""}
      <div><h3>${plan.name}</h3><p class="muted">${plan.caption}</p></div>
      <div class="price">${price} ر.س <small>/ شهريًا</small></div>
      <p class="muted">${plan.customers} · ${plan.alerts}</p>
      <ul class="check-list">${plan.features.slice(0, short ? 3 : plan.features.length).map((item) => `<li>${item}</li>`).join("")}</ul>
      <button class="btn btn-primary" data-action="select-plan" data-plan="${plan.id}">ابدأ الآن</button>
    </article>`;
  }).join("")}</div>`;
}

function homePage() {
  return publicShell(`<main>
    <section class="hero">
      <div class="container hero-grid">
        <div>
          <span class="eyebrow">منصة تجديدات ذكية</span>
          <h1>إدارة الاشتراكات والتجديدات بذكاء</h1>
          <p class="lead">منصة تساعدك على تتبع اشتراكات عملائك، إرسال تنبيهات التجديد تلقائيًا، وزيادة معدلات التجديد والإيرادات.</p>
          <div class="hero-actions">
            <button class="btn btn-primary" data-link="/login">ابدأ مجانًا</button>
            <button class="btn btn-secondary" data-link="/dashboard">شاهد لوحة التحكم</button>
          </div>
          <div class="trust-row">
            <div class="trust-item"><strong>99.9%</strong><span>وقت تشغيل</span></div>
            <div class="trust-item"><strong>+10,000</strong><span>عميل نشط</span></div>
            <div class="trust-item"><strong>+300%</strong><span>زيادة في التجديدات</span></div>
          </div>
        </div>
        ${dashboardPreview()}
      </div>
    </section>
    <section class="section"><div class="container">
      <div class="section-head"><div><h2>كل ما تحتاجه لإدارة دورة التجديد</h2><p class="muted">تنبيهات، عملاء، ضمان، وتحليلات من لوحة واحدة.</p></div><button class="btn btn-secondary" data-link="/features">عرض كل المميزات</button></div>
      ${featureGrid(4)}
    </div></section>
    <section class="section"><div class="container">
      <div class="section-head"><div><h2>باقات واضحة وقابلة للنمو</h2><p class="muted">ابدأ صغيرًا ثم وسع التشغيل بدون تعقيد.</p></div><button class="btn btn-secondary" data-link="/pricing">مقارنة الباقات</button></div>
      ${pricingCards(true)}
    </div></section>
    <section class="section"><div class="container">
      <div class="section-head"><div><h2>من التنبيه إلى التجديد في 3 خطوات ذكية</h2><p class="muted">سير عمل بسيط يحافظ على العميل قريبًا من قرار التجديد.</p></div></div>
      <div class="grid grid-3 steps">
        ${["تنبيه ذكي", "رابط تجديد آمن", "تجديد وتأكيد فوري"].map((item) => `<article class="card step-card"><h3>${item}</h3><p class="muted">خطوة منظمة قابلة للتتبع مع سجل كامل لكل عميل.</p></article>`).join("")}
      </div>
    </div></section>
    <section class="section"><div class="container">${cta()}</div></section>
  </main>`);
}

function cta() {
  return `<div class="cta-band"><div><h2>ابدأ بتحويل التجديدات إلى إيرادات متوقعة</h2><p>كل عميل، كل رسالة، وكل رابط تجديد في نظام واضح.</p></div><button class="btn btn-secondary" data-link="/login">ابدأ الآن</button></div>`;
}

function featuresPage() {
  return publicShell(`<main>
    ${pageHero("مميزات ذكية لإدارة الاشتراكات والتجديدات", "أدوات مترابطة تساعد فريقك على تقليل الفوات، تحسين التواصل، ورفع معدل التجديد.", `<button class="btn btn-primary" data-link="/login">ابدأ مجانًا</button><button class="btn btn-secondary" data-action="open-demo">احجز عرضًا توضيحيًا</button>`)}
    <section class="section"><div class="container">${featureGrid()}</div></section>
    <section class="section"><div class="container">
      <div class="section-head"><div><h2>من التنبيه إلى التجديد في 3 خطوات ذكية</h2><p class="muted">رسالة دقيقة، رابط واضح، وتأكيد فوري في سجل العميل.</p></div></div>
      <div class="grid grid-3 steps">
        ${["تنبيه ذكي", "رابط تجديد آمن", "تجديد وتأكيد فوري"].map((item) => `<article class="card step-card"><h3>${item}</h3><p class="muted">تجربة مبسطة تقلل المتابعة اليدوية وتزيد الوضوح للعميل.</p></article>`).join("")}
      </div>
    </div></section>
  </main>`);
}

function pricingPage() {
  return publicShell(`<main>
    ${pageHero("خطط أسعار مرنة تناسب جميع المتاجر", "اختر الباقة المناسبة الآن، ويمكنك ترقية الخطة عندما يكبر حجم الاشتراكات.", `<div class="pricing-toggle"><button class="toggle-pill ${state.billing === "monthly" ? "active" : ""}" data-action="billing" data-billing="monthly">شهري</button><button class="toggle-pill ${state.billing === "yearly" ? "active" : ""}" data-action="billing" data-billing="yearly">سنوي وفر 20%</button></div>`)}
    <section class="section"><div class="container">${pricingCards()}</div></section>
    <section class="section"><div class="container">
      <div class="section-head"><div><h2>مقارنة الباقات</h2><p class="muted">تفاصيل تساعدك على اختيار الخطة بدقة.</p></div></div>
      <div class="card compare"><table><thead><tr><th>الميزة</th><th>Starter</th><th>Pro</th><th>Business</th></tr></thead><tbody>
        ${["عدد العملاء", "عدد التنبيهات شهريًا", "تنبيهات واتساب", "بوابة العملاء", "التحليلات", "المركز الضماني", "الذكاء الاصطناعي", "API", "الفريق والصلاحيات"].map((row, i) => `<tr><td>${row}</td><td>${i < 2 ? (i ? "2,000" : "500") : i < 5 ? "أساسي" : "غير متاح"}</td><td>${i < 2 ? (i ? "20,000" : "5,000") : "متاح"}</td><td>${i < 2 ? "غير محدود" : "متقدم"}</td></tr>`).join("")}
      </tbody></table></div>
    </div></section>
    <section class="section"><div class="container"><div class="grid grid-4">
      ${["تجربة مجانية", "دعم فني", "أمان وخصوصية", "ضمان استعادة الأموال"].map((item, i) => `<article class="card feature-card">${icon(String(i + 1), i % 2 ? "green" : "")}<h3>${item}</h3><p class="muted">سياسة واضحة تساعدك على البدء بثقة.</p></article>`).join("")}
    </div></div></section>
  </main>`);
}

function supportPage() {
  return publicShell(`<main>
    ${pageHero("مركز الدعم والمساعدة", "فريق دعم متخصص جاهز لمساعدتك في كل خطوة.")}
    <section class="section section-tight"><div class="container">
      <div class="support-search search-wrap"><span class="search-icon">⌕</span><input class="input" data-action="support-search" placeholder="ابحث في المقالات والمساعدة..." value="${state.search}"></div>
      <div class="chips">${["ربط مزود البريد", "إنشاء أول اشتراك", "حل مشكلة التكامل", "تحديث طريقة الدفع"].map((item) => `<button class="chip" data-action="support-chip" data-term="${item}">${item}</button>`).join("")}</div>
    </div></section>
    <section class="section"><div class="container">
      <div class="grid grid-4">
        ${[
          ["فتح تذكرة دعم", "أرسل تفاصيل المشكلة وسنرتبها حسب الأولوية.", "فتح تذكرة جديدة", "open-ticket"],
          ["الدردشة المباشرة", "ابدأ محادثة فورية مع فريق الدعم.", "ابدأ الدردشة", "open-chat"],
          ["تواصل عبر البريد", "اكتب رسالة دعم مفصلة عبر البريد.", "إرسال بريد", "open-email"],
          ["تواصل عبر واتساب", "افتح محادثة واتساب مبدئية.", "بدء محادثة واتساب", "open-whatsapp"]
        ].map(([title, body, btn, action], i) => `<article class="card support-card">${icon(title.slice(0, 1), i === 1 ? "green" : i === 2 ? "purple" : i === 3 ? "orange" : "")}<h3>${title}</h3><p class="muted">${body}</p><button class="btn btn-secondary" data-action="${action}">${btn}</button></article>`).join("")}
      </div>
    </div></section>
    <section class="section"><div class="container split">
      <article class="card table-card"><h2>قاعدة المعرفة</h2><div class="grid grid-3">${knowledgeBase.map((item) => `<button class="chip" data-action="knowledge" data-term="${item}">${item}</button>`).join("")}</div></article>
      <article class="card table-card"><h2>مساعد RenewPilot AI</h2><p class="muted">اكتب سؤالك وسنعرض ردًا مبدئيًا إلى حين ربط المساعد.</p><form data-submit="ai-question"><textarea class="textarea" name="question" required placeholder="اكتب سؤالك هنا"></textarea><br><button class="btn btn-primary">إرسال السؤال</button></form></article>
    </div></section>
    <section class="section"><div class="container"><article class="card table-card"><h2>حالة التذاكر</h2>${simpleTable(["رقم التذكرة", "الموضوع", "الحالة"], [["TK-108", "ربط مزود البريد", status("قيد الانتظار")], ["TK-104", "تحديث طريقة الدفع", status("محلولة")]])}</article></div></section>
  </main>`);
}

function loginPage() {
  return `<main class="auth-page">
    <section class="auth-shell">
      <article class="card auth-panel">
        ${logo()}
        <br><br>
        <h1>مرحبًا بعودتك</h1>
        <p class="lead">أدر التجديدات والاشتراكات بذكاء</p>
        ${state.query.get("plan") ? `<p class="badge">الخطة المختارة: ${state.query.get("plan")}</p>` : ""}
        <form data-submit="login" class="grid">
          <label class="field"><span>البريد الإلكتروني</span><input class="input" type="email" name="email" placeholder="name@example.com"></label>
          <label class="field"><span>كلمة المرور</span><input class="input" type="password" name="password" placeholder="••••••••"></label>
          <div class="inline-actions split-between">
            <label><input type="checkbox" name="remember"> تذكرني</label>
            <button type="button" class="btn btn-ghost" data-action="forgot-password">نسيت كلمة المرور؟</button>
          </div>
          <button class="btn btn-primary">تسجيل الدخول</button>
          <button type="button" class="btn btn-secondary" data-action="google-login">المتابعة باستخدام Google</button>
          <button type="button" class="btn btn-ghost" data-link="/login">إنشاء حساب جديد</button>
        </form>
      </article>
      <aside class="card auth-visual">
        <span class="eyebrow">RenewPilot AI</span>
        <h2>لوحة واحدة لتقليل التجديدات الفائتة</h2>
        <p class="muted">تنبيهات تلقائية، روابط تجديد، مركز ضمان، وتحليلات تساعدك على اتخاذ القرار أسرع.</p>
        ${dashboardPreview()}
      </aside>
    </section>
  </main>`;
}

function dashboardShell(content) {
  const links = dashboardRoutes.map(([path, label, mark]) => `<button class="side-link ${state.route === path ? "active" : ""}" data-link="${path}"><span>${mark}</span>${label}</button>`).join("");
  const themeIcon = state.theme === "dark" ? "☾" : "☀";
  return `<div class="dashboard-shell">
    <aside class="sidebar ${state.sidebarOpen ? "open" : ""}">
      ${logo()}
      <nav class="side-links">${links}</nav>
      <div class="ai-side"><strong>مساعد RenewPilot AI</strong><p class="muted">اقتراحات فورية للتجديدات والتنبيهات.</p><button class="btn btn-secondary" data-action="show-ai-tips">عرض الاقتراحات</button></div>
    </aside>
    <main class="dashboard-main">
      <header class="topbar">
        <div class="topbar-tools">
          <button class="btn btn-secondary icon-btn mobile-side-toggle" data-action="toggle-sidebar">☰</button>
          <div class="search-wrap"><span class="search-icon">⌕</span><input class="input" data-action="global-search" placeholder="بحث سريع..." value="${state.search}"></div>
        </div>
        <div class="topbar-tools">
          <span class="badge">Pro Plan</span>
          <button class="btn btn-ghost icon-btn" data-action="notifications">🔔</button>
          <button class="btn btn-ghost icon-btn" data-action="theme">${themeIcon}</button>
          <button class="btn btn-secondary" data-action="language">${state.language.toUpperCase()}</button>
          <span class="avatar">م</span><strong>محمد المدير</strong>
        </div>
      </header>
      <div class="content">${content}</div>
    </main>
  </div>`;
}

function dashboardHome() {
  return dashboardShell(`${pageTitle("نظرة عامة", `<button class="btn btn-primary" data-link="/dashboard/subscriptions">عرض جميع الاشتراكات</button>`)}
    ${statGrid(metrics.dashboard)}
    <div class="section split">
      <article class="card table-card"><div class="section-head"><div><h2>أحدث الاشتراكات</h2><p class="muted">آخر عمليات نشطة ومجدولة.</p></div></div>${subscriptionsTable(state.subscriptions.slice(0, 5), true)}</article>
      <article class="card chart-card"><h2>الإيرادات</h2>${barsChart(reports.revenue)}<button class="btn btn-secondary" data-action="export-report">تصدير التقرير</button></article>
    </div>
    <div class="split">
      <article class="card table-card"><h2>النشاط الأخير</h2>${activityList()}</article>
      ${aiCard()}
    </div>`);
}

function pageTitle(title, actions = "") {
  return `<div class="page-title"><div><h1>${title}</h1><p class="muted">RenewPilot AI · الوضع الشمسي</p></div><div class="toolbar">${actions}</div></div>`;
}

function activityList() {
  return `<div class="activity-list">${["تم إرسال تنبيه تجديد إلى سارة العتيبي", "تم نسخ رابط التجديد للطلب #RP-1047", "تم تحديث حالة ضمان WR-2201", "تم حفظ إعدادات التنبيهات"].map((item, i) => `<div class="activity-item">${icon(String(i + 1), i === 2 ? "purple" : "")}<div><strong>${item}</strong><p class="muted">منذ ${i + 1} دقائق</p></div></div>`).join("")}</div>`;
}

function aiCard() {
  return `<article class="card table-card"><h2>اقتراحات RenewPilot AI</h2><p class="muted">العميل سارة العتيبي يستجيب غالبًا بعد الظهر. استخدم رسالة مختصرة مع رابط التجديد.</p><div class="inline-actions"><button class="btn btn-primary" data-action="copy-ai-message">استخدام الرسالة</button><button class="btn btn-secondary" data-action="show-ai-tips">عرض المزيد من الاقتراحات</button></div></article>`;
}

function barsChart(values) {
  return `<div class="bars">${values.map((v, i) => `<div class="bar" style="height:${v}%"><span>${["ينا", "فبر", "مار", "أبر", "ماي", "يون", "يول", "أغس"][i]}</span></div>`).join("")}</div>`;
}

function subscriptionsPage() {
  const rows = filterRows(state.subscriptions, ["order", "customer", "plan", "status"]);
  return dashboardShell(`${pageTitle("إدارة الاشتراكات", `<button class="btn btn-primary" data-action="add-subscription">إضافة اشتراك جديد</button><button class="btn btn-secondary" data-action="columns">أعمدة</button><button class="btn btn-secondary" data-action="export-subscriptions">تصدير</button>`)}
    ${statGrid(metrics.subscriptions)}
    ${tableToolbar(["الكل", "نشط", "تنتهي قريبًا", "متأخر", "موقوف", "تم التجديد"])}
    <article class="card table-card">${rows.length ? subscriptionsTable(rows) : emptyState("لا توجد اشتراكات مطابقة")}</article>`);
}

function subscriptionsTable(rows, compact = false) {
  const head = compact ? ["رقم الطلب", "العميل", "الباقة", "الحالة", "الإجراء"] : ["رقم الطلب", "العميل", "الباقة", "تاريخ البداية", "تاريخ الانتهاء", "الحالة", "التجديد", "الإجراء"];
  const body = rows.map((row, index) => compact
    ? [row.order, row.customer, row.plan, status(row.status), `<button class="btn btn-secondary" data-action="renew-now" data-key="${row.order}">تجديد الآن</button>`]
    : [row.order, row.customer, row.plan, row.start, row.end, status(row.status), `<button class="btn btn-ghost" data-action="copy-renewal" data-link-value="${row.renewal}">نسخ الرابط</button>`, rowActions("subscription", row.order)]).map((cells) => `<tr>${cells.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("");
  return `<div class="compare"><table><thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function rowActions(type, key) {
  return `<div class="inline-actions">
    <button class="btn btn-secondary" data-action="${type}-details" data-key="${key}">عرض</button>
    <button class="btn btn-ghost" data-action="${type}-edit" data-key="${key}">تعديل</button>
    <button class="btn btn-danger" data-action="${type}-delete" data-key="${key}">حذف</button>
  </div>`;
}

function tableToolbar(filters) {
  return `<div class="toolbar mb-toolbar">
    <div class="search-wrap"><span class="search-icon">⌕</span><input class="input" data-action="dashboard-search" placeholder="بحث في البيانات..." value="${state.search}"></div>
    <select class="select" data-action="dashboard-filter">${filters.map((item) => `<option ${state.filter === item ? "selected" : ""}>${item}</option>`).join("")}</select>
    <button class="btn btn-secondary" data-action="apply-filter">تصفية</button>
  </div>`;
}

function filterRows(rows, keys) {
  const q = state.search.trim();
  return rows.filter((row) => {
    const matchFilter = state.filter === "الكل" || Object.values(row).includes(state.filter);
    const matchSearch = !q || keys.some((key) => String(row[key] || "").includes(q));
    return matchFilter && matchSearch;
  });
}

function customersPage() {
  const rows = filterRows(state.customers, ["name", "email", "phone", "plan", "status"]);
  return dashboardShell(`${pageTitle("إدارة العملاء", `<button class="btn btn-primary" data-action="add-customer">إضافة عميل</button><button class="btn btn-secondary" data-action="send-message">إرسال رسالة</button>`)}
    ${statGrid(metrics.customers)}
    ${tableToolbar(["الكل", "نشط", "تنتهي قريبًا", "متأخر", "تم التجديد"])}
    <article class="card table-card">${customersTable(rows)}</article>`);
}

function customersTable(rows) {
  if (!rows.length) return emptyState("لا يوجد عملاء مطابقون");
  const body = rows.map((row) => `<tr><td>${row.name}</td><td>${row.email}</td><td>${row.phone}</td><td>${row.plan}</td><td>${row.renewal}</td><td>${status(row.status)}</td><td>${row.total}</td><td>${rowActions("customer", row.email)}</td></tr>`).join("");
  return `<div class="compare"><table><thead><tr>${["العميل", "البريد", "الجوال", "الباقة", "تاريخ التجديد", "الحالة", "القيمة الإجمالية", "الإجراء"].map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function renewalsPage() {
  const columns = ["اليوم", "خلال 3 أيام", "هذا الأسبوع", "متأخر"];
  return dashboardShell(`${pageTitle("إدارة التجديدات", `<button class="btn btn-primary" data-action="export-renewals">تصدير التجديدات</button>`)}
    ${statGrid(metrics.renewals)}
    <section class="section board-card card"><div class="renewal-board">
      ${columns.map((column) => `<div class="board-column"><h3>${column}</h3>${renewals.filter((r) => r.bucket === column).map((item, index) => `<div class="renewal-card"><strong>${item.customer}</strong><span class="muted">${item.service} · ${item.amount}</span><span>${item.due}</span><button class="btn btn-primary" data-action="send-renewal-link" data-customer="${item.customer}">إرسال رابط التجديد</button><button class="btn btn-secondary" data-action="follow-customer" data-customer="${item.customer}">متابعة العميل</button></div>`).join("") || `<p class="muted">لا توجد عناصر</p>`}</div>`).join("")}
    </div></section>
    <div class="grid grid-3"><article class="card table-card"><h3>اتجاه التجديدات</h3>${barsChart([40, 55, 62, 70, 86])}</article><article class="card table-card"><h3>توصيات الذكاء الاصطناعي</h3><p class="muted">أرسل الروابط عالية القيمة قبل الظهر وكرر المتابعة بعد 48 ساعة.</p></article><article class="card table-card"><h3>أفضل وقت للتجديد</h3><strong>10:00 صباحًا - 1:00 ظهرًا</strong></article></div>`);
}

function notificationsPage() {
  const filtered = state.notifications.filter((item) => item.channel === state.notificationTab);
  return dashboardShell(`${pageTitle("التنبيهات التلقائية", `<button class="btn btn-primary" data-action="add-rule">إضافة قاعدة أتمتة</button>`)}
    ${statGrid(metrics.notifications)}
    <div class="tabs tabs-row">${["واتساب", "البريد الإلكتروني", "SMS"].map((tab) => `<button class="tab ${state.notificationTab === tab ? "active" : ""}" data-action="notification-tab" data-tab="${tab}">${tab}</button>`).join("")}</div>
    <div class="split">
      <article class="card table-card"><h2>جدول الرسائل</h2>${notificationsTable(filtered)}</article>
      <article class="card table-card"><h2>قوالب الرسائل</h2><p class="muted">مرحبًا {{name}}، اشتراكك ينتهي قريبًا. جدد الآن من الرابط الآمن.</p><div class="inline-actions"><button class="btn btn-secondary" data-action="preview-template">معاينة قالب</button><button class="btn btn-primary" data-action="edit-template">تعديل القالب</button><button class="btn btn-secondary" data-action="suggest-template">اقتراح نص بالذكاء الاصطناعي</button></div></article>
    </div>
    <section class="section"><article class="card table-card"><h2>قواعد الأتمتة</h2><div class="grid grid-3">${automationToggle("seven", "قبل الانتهاء بـ 7 أيام")}${automationToggle("three", "قبل الانتهاء بـ 3 أيام")}${automationToggle("same", "يوم الانتهاء")}</div></article></section>`);
}

function notificationsTable(rows) {
  if (!rows.length) return emptyState("لا توجد رسائل في هذه القناة");
  const body = rows.map((row) => `<tr><td>${row.channel}</td><td>${row.recipient}</td><td>${row.template}</td><td>${status(row.status)}</td><td>${row.time}</td><td><button class="btn btn-secondary" data-action="message-view" data-key="${row.recipient}">عرض</button><button class="btn btn-ghost" data-action="resend-message" data-key="${row.recipient}">إعادة إرسال</button></td></tr>`).join("");
  return `<div class="compare"><table><thead><tr>${["القناة", "المستلم", "القالب", "الحالة", "وقت الإرسال", "الإجراء"].map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function automationToggle(key, label) {
  return `<label class="card feature-card"><strong>${label}</strong><p class="muted">قاعدة قابلة للتفعيل والإيقاف مباشرة.</p><input type="checkbox" data-action="automation-toggle" data-key="${key}" ${state.automation[key] ? "checked" : ""}></label>`;
}

function warrantyPage() {
  return dashboardShell(`${pageTitle("المركز الضماني", `<button class="btn btn-primary" data-action="new-warranty">حالة جديدة</button>`)}
    ${statGrid(metrics.warranty)}
    <div class="split">
      <article class="card table-card"><h2>جدول الحالات</h2>${warrantyTable()}</article>
      <article class="card table-card"><h2>تفاصيل الحالة</h2><p class="muted">اختر حالة من الجدول لعرض الخط الزمني والملاحظات.</p><div id="warranty-detail">${caseDetail(state.warrantyCases[0])}</div></article>
    </div>
    <section class="section"><div class="grid grid-3"><article class="card table-card"><h3>الخط الزمني للحالة</h3>${activityList()}</article><article class="card table-card"><h3>مساعد الذكاء الاصطناعي</h3><p class="muted">الإجراء المقترح: طلب صورة إضافية ثم اعتماد الاستبدال.</p><button class="btn btn-primary" data-action="apply-warranty-suggestion">تنفيذ الإجراء المقترح</button></article><article class="card table-card"><h3>ملاحظات داخلية</h3><textarea class="textarea" id="warranty-note" placeholder="أضف ملاحظة داخلية"></textarea><button class="btn btn-secondary" data-action="add-note">إضافة ملاحظة</button></article></div></section>`);
}

function warrantyTable() {
  const body = state.warrantyCases.map((row, index) => `<tr><td>${row.id}</td><td>${row.customer}</td><td>${row.service}</td><td>${row.issue}</td><td>${status(row.priority)}</td><td>${status(row.status)}</td><td>${row.updated}</td><td><button class="btn btn-secondary" data-action="case-details" data-index="${index}">عرض التفاصيل الكاملة</button><button class="btn btn-ghost" data-action="case-options">خيارات أخرى</button></td></tr>`).join("");
  return `<div class="compare"><table><thead><tr>${["رقم الحالة", "العميل", "نوع الخدمة", "نوع المشكلة", "الأولوية", "الحالة", "آخر تحديث", "الإجراء"].map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function caseDetail(row) {
  return `<div class="grid"><p><strong>${row.id}</strong> · ${row.customer}</p><p class="muted">${row.service} - ${row.issue}</p>${status(row.status)}<div class="inline-actions"><button class="btn btn-secondary" data-action="update-case">تحديث حالة</button><button class="btn btn-ghost" data-action="case-options">عرض خيارات أخرى</button></div></div>`;
}

function reportsPage() {
  return dashboardShell(`${pageTitle("التقارير والتحليلات", `<button class="btn btn-secondary" data-action="date-filter">فلترة التاريخ</button><button class="btn btn-primary" data-action="export-report">تصدير التقرير</button>`)}
    ${statGrid(metrics.reports)}
    <div class="grid grid-3 section">
      <article class="card chart-card"><h2>الإيرادات الشهرية</h2>${barsChart(reports.revenue)}</article>
      <article class="card chart-card"><h2>التجديدات حسب الباقة</h2>${donutChart()}</article>
      <article class="card chart-card"><h2>العملاء حسب الفئة</h2>${barsChart([35, 62, 45, 72])}</article>
    </div>
    <div class="split">
      <article class="card table-card"><h2>أفضل الباقات أداءً</h2>${simpleTable(["الباقة", "النسبة", "الإيرادات"], reports.plans.map((p) => [p.name, p.value, p.amount]))}<button class="btn btn-secondary" data-action="report-details">عرض التفاصيل</button></article>
      <article class="card table-card"><h2>رؤى الذكاء الاصطناعي</h2><ul class="check-list">${reports.insights.map((item) => `<li>${item}</li>`).join("")}</ul><button class="btn btn-primary" data-action="all-insights">عرض جميع الرؤى</button></article>
    </div>`);
}

function connectedDevicesPage() {
  const device = { ...defaultLinkedDevice, ...state.linkedDevice };
  const isConnected = device.status === "connected";
  const isPending = device.status === "pending_qr";
  const statusText = isConnected ? "متصل" : isPending ? "بانتظار المسح" : device.status === "disconnected" ? "غير متصل" : "غير مربوط";
  const statusTone = isConnected ? "success" : isPending ? "warning" : "danger";
  const usage = isConnected ? "1 / 1" : "0 / 1";
  const activity = device.activity.length ? device.activity : ["لا توجد أجهزة مرتبطة حتى الآن"];
  const qrCell = isPending ? Array.from({ length: 49 }).map((_, index) => `<span class="${[0, 1, 7, 8, 40, 41, 48, 12, 18, 22, 24, 31, 35].includes(index) ? "active" : ""}"></span>`).join("") : Array.from({ length: 49 }).map((_, index) => `<span class="${index % 6 === 0 ? "ghost" : ""}"></span>`).join("");

  return dashboardShell(`${pageTitle("الأجهزة المرتبطة", `<button class="btn btn-primary" data-action="create-device-qr">${isPending || isConnected ? "إعادة إنشاء الباركود" : "ربط واتساب"}</button>`)}
    <p class="linked-subtitle">قم بربط واتساب وإدارة أجهزتك المرتبطة بأمان لتواصل فعال مع عملائك.</p>
    <section class="linked-layout">
      <article class="card linked-main-card">
        <div class="device-art" aria-hidden="true">
          <div class="phone-frame"><span class="wa-logo">☎</span></div>
          <div class="qr-float">
            <div class="qr-mini">${qrCell}</div>
          </div>
        </div>
        <div class="link-panel">
          <div class="section-head compact-head">
            <div>
              <h2>ربط واتساب</h2>
              <p class="muted">اتصال آمن عبر Evolution API self-hosted من الخادم فقط.</p>
            </div>
            <span class="status ${statusTone}">${statusText}</span>
          </div>
          <div class="link-box-grid">
            <div class="qr-box ${isPending ? "active" : ""}" data-action="show-device-qr">
              <div class="qr-grid">${qrCell}</div>
              <strong>${isPending ? "الباركود جاهز للمسح" : isConnected ? "الجهاز متصل" : "سيظهر الباركود هنا"}</strong>
              <small class="muted">${isPending ? `صالح حتى ${device.qrExpiresAt}` : isConnected ? device.deviceName : "أنشئ جلسة Evolution لعرض QR"}</small>
            </div>
            <div class="or-divider">أو</div>
            <div class="pair-code">
              <span class="muted">رمز الاقتران</span>
              <strong>${device.pairingCode}</strong>
              <button class="btn btn-secondary" data-action="copy-pairing">نسخ رمز الاقتران</button>
              <button class="btn btn-primary" data-action="create-device-qr">${isPending || isConnected ? "إعادة إنشاء باركود" : "إنشاء باركود جديد"}</button>
              <button class="btn btn-secondary" data-action="check-device-connection" ${!isPending && !isConnected ? "disabled" : ""}>فحص الاتصال</button>
              ${isPending ? `<button class="btn btn-primary" data-action="confirm-device-link">تأكيد الربط التجريبي</button>` : ""}
              ${isConnected ? `<button class="btn btn-secondary" data-action="send-device-test">إرسال رسالة اختبار</button><button class="btn btn-danger" data-action="disconnect-device">فصل الجهاز</button><button class="btn btn-ghost" data-action="delete-device">حذف الجهاز</button>` : ""}
            </div>
          </div>
        </div>
      </article>
      <aside class="card link-steps-card">
        <h2>طريقة الربط</h2>
        ${["افتح واتساب على هاتفك", "اذهب إلى الأجهزة المرتبطة", "امسح الباركود أو أدخل رمز الاقتران"].map((step, index) => `<div class="step-row"><span>${index + 1}</span><strong>${step}</strong><p class="muted">${index === 2 ? "اترك واتساب مفتوحا أثناء عملية الربط حتى تكتمل بنجاح." : "اتبع الخطوة من تطبيق واتساب الرسمي."}</p></div>`).join("")}
        <div class="secure-note">اتصال مشفر ولا يتم عرض مفاتيح Evolution API في الواجهة.</div>
      </aside>
    </section>
    <section class="linked-bottom-grid">
      <article class="card usage-card">
        <h3>استخدام الأجهزة المرتبطة</h3>
        <strong class="usage-count">${usage} جهاز مرتبط</strong>
        <div class="usage-bar"><span style="width:${isConnected ? 100 : 0}%"></span></div>
        <p class="${isConnected ? "success-text" : "danger-text"}">${isConnected ? "تم ربط جهاز واتساب بنجاح" : "لم يتم ربط أي جهاز بعد"}</p>
        <small class="muted">الحد الأقصى حسب خطتك الحالية</small>
      </article>
      <article class="card table-card">
        <h3>ملاحظات الأمان</h3>
        <ul class="check-list">
          <li>كل طلبات Evolution تتم من الباكند فقط.</li>
          <li>لا يتم تخزين أو عرض أي مفتاح API في الواجهة.</li>
          <li>عند فصل الجهاز تتوقف رسائل واتساب تلقائيا.</li>
          <li>لا يمكن لمستأجر استخدام جهاز مستأجر آخر.</li>
        </ul>
      </article>
      <article class="card table-card linked-table-card">
        <h3>الأجهزة المرتبطة الأخيرة</h3>
        ${isConnected ? simpleTable(["الجهاز", "رقم واتساب", "الحالة", "آخر نشاط", "الإجراءات"], [[device.deviceName, device.phoneNumber, status("نشط"), device.lastActivity || "الآن", `<button class="btn btn-secondary" data-action="check-device-connection">فحص</button>`]]) : `<div class="empty-device"><div class="empty-icon">🔗</div><strong>لا توجد أجهزة مرتبطة حتى الآن</strong><p class="muted">قم بربط واتساب لعرض الأجهزة المرتبطة وسجل النشاط.</p></div>`}
      </article>
      <article class="card table-card">
        <h3>النشاط الأخير</h3>
        <div class="activity-list">${activity.map((item, index) => `<div class="activity-item">${icon(String(index + 1), isConnected ? "green" : "")}<div><strong>${item}</strong><p class="muted">${isConnected ? "تم التحديث الآن" : "بانتظار الربط"}</p></div></div>`).join("")}</div>
      </article>
    </section>`);
}

function donutChart() {
  return `<svg viewBox="0 0 160 160" width="100%" height="220" role="img" aria-label="رسم دائري">
    <circle cx="80" cy="80" r="52" fill="none" stroke="#e2e8f0" stroke-width="24" />
    <circle cx="80" cy="80" r="52" fill="none" stroke="#0797A5" stroke-width="24" stroke-dasharray="155 327" stroke-linecap="round" transform="rotate(-90 80 80)" />
    <circle cx="80" cy="80" r="52" fill="none" stroke="#2563EB" stroke-width="24" stroke-dasharray="100 327" stroke-dashoffset="-160" stroke-linecap="round" transform="rotate(-90 80 80)" />
    <text x="80" y="78" text-anchor="middle" font-size="18" font-weight="800" fill="#0F172A">1.8M</text>
    <text x="80" y="98" text-anchor="middle" font-size="10" fill="#64748B">ر.س</text>
  </svg>`;
}

function settingsPage() {
  const sections = [
    ["الملف الشخصي", "تحديث الاسم والبريد وبيانات التواصل.", "حفظ التغييرات"],
    ["معلومات الشركة / المتجر", "اسم المتجر والسجل ومعلومات الفوترة.", "حفظ التغييرات"],
    ["إشعارات التنبيهات", "تحكم بقنوات الإرسال والقوالب.", "حفظ التغييرات"],
    ["التكاملات", "ربط واتساب والبريد والدفع.", "إدارة التكاملات"],
    ["إعدادات التجديد", "قواعد التجديد التلقائي والرسائل.", "حفظ التغييرات"],
    ["الأمان", "كلمة المرور والتحقق الثنائي.", "تغيير كلمة المرور"],
    ["الفريق والصلاحيات", "أعضاء الفريق والأدوار.", "إدارة الفريق"],
    ["الفوترة والخطة", "الفواتير والخطة الحالية.", "إدارة الفواتير"],
    ["اللغة والمظهر", "العربية والوضع الشمسي مفعّلان.", "حفظ التغييرات"]
  ];
  return dashboardShell(`${pageTitle("الإعدادات", `<button class="btn btn-primary" data-action="save-settings">حفظ التغييرات</button>`)}
    <div class="grid grid-3">${sections.map(([title, body, action], i) => `<article class="card settings-card">
      ${icon(title.slice(0, 1), i % 3 === 1 ? "purple" : i % 3 === 2 ? "green" : "")}
      <h3>${title}</h3><p class="muted">${body}</p>
      ${i === 2 ? settingToggle("whatsapp", "واتساب") + settingToggle("email", "البريد الإلكتروني") + settingToggle("sms", "SMS") : ""}
      ${i === 4 ? settingToggle("renewAuto", "التجديد التلقائي") : ""}
      ${i === 5 ? settingToggle("twoFactor", "التحقق الثنائي") : ""}
      <button class="btn btn-secondary" data-action="${action === "حفظ التغييرات" ? "save-settings" : action === "إدارة التكاملات" ? "manage-integrations" : action === "تغيير كلمة المرور" ? "change-password" : action === "إدارة الفريق" ? "manage-team" : "manage-billing"}">${action}</button>
    </article>`).join("")}</div>`);
}

function settingToggle(key, label) {
  return `<label class="inline-actions setting-toggle"><span>${label}</span><input type="checkbox" data-action="setting-toggle" data-key="${key}" ${state.settings[key] ? "checked" : ""}></label>`;
}

function simpleTable(headers, rows) {
  return `<div class="compare"><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function emptyState(text) {
  return `<div class="empty"><strong>${text}</strong><p>جرّب تعديل البحث أو الفلترة.</p></div>`;
}

function openModal(title, body, foot = "") {
  portal.innerHTML = `<div class="modal-overlay" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true" onclick="event.stopPropagation()">
    <header class="modal-head"><h2>${title}</h2><button class="btn btn-ghost icon-btn" data-action="close-modal">×</button></header>
    <div class="modal-body">${body}</div>
    ${foot ? `<footer class="modal-foot">${foot}</footer>` : ""}
  </section></div>`;
}

function openDrawer(title, body) {
  portal.innerHTML = `<div class="drawer-overlay" data-action="close-modal"><aside class="drawer" onclick="event.stopPropagation()">
    <header class="modal-head"><h2>${title}</h2><button class="btn btn-ghost icon-btn" data-action="close-modal">×</button></header>
    <div class="modal-body">${body}</div>
  </aside></div>`;
}

function closePortal() {
  portal.innerHTML = "";
}

function toast(message, type = "success") {
  let stack = document.querySelector(".toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-stack";
    document.body.appendChild(stack);
  }
  const item = document.createElement("div");
  item.className = `toast ${type}`;
  item.textContent = message;
  stack.appendChild(item);
  setTimeout(() => item.remove(), 3200);
}

function demoForm() {
  return `<form data-submit="demo" class="form-grid">
    ${field("الاسم", "name", "text")}${field("البريد", "email", "email")}${field("رقم الجوال", "phone", "tel")}
    <label class="field full-span"><span>ملاحظة</span><textarea class="textarea" name="note"></textarea></label>
    <button class="btn btn-primary">إرسال</button><button type="button" class="btn btn-secondary" data-action="close-modal">إلغاء</button>
  </form>`;
}

function field(label, name, type = "text", value = "", required = true) {
  return `<label class="field"><span>${label}</span><input class="input" type="${type}" name="${name}" value="${value}" ${required ? "required" : ""}></label>`;
}

function subscriptionForm(row = {}, editKey = "") {
  return `<form data-submit="subscription" data-edit-key="${editKey}" class="form-grid">
    ${field("رقم الطلب", "order", "text", row.order || `#RP-${Math.floor(1100 + Math.random() * 800)}`)}
    ${field("اسم العميل", "customer", "text", row.customer || "")}
    ${field("رقم الجوال", "phone", "tel", row.phone || "")}
    ${field("نوع الخدمة", "service", "text", row.service || "")}
    ${field("الباقة", "plan", "text", row.plan || "Pro")}
    ${field("تاريخ البداية", "start", "date", row.start || "2026-07-09")}
    ${field("تاريخ النهاية", "end", "date", row.end || "2026-08-09")}
    ${field("رابط التجديد", "renewal", "url", row.renewal || "https://renewpilot.ai/pay/new")}
    <label class="field"><span>حالة الاشتراك</span><select class="select" name="status">${["نشط", "تنتهي قريبًا", "متأخر", "موقوف", "تم التجديد"].map((s) => `<option ${row.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
    <div class="inline-actions"><button class="btn btn-primary">حفظ</button><button type="button" class="btn btn-secondary" data-action="close-modal">إلغاء</button></div>
  </form>`;
}

function customerForm(row = {}, editKey = "") {
  return `<form data-submit="customer" data-edit-key="${editKey}" class="form-grid">
    ${field("اسم العميل", "name", "text", row.name || "")}${field("البريد", "email", "email", row.email || "")}${field("الجوال", "phone", "tel", row.phone || "")}${field("الباقة", "plan", "text", row.plan || "Pro")}${field("تاريخ التجديد", "renewal", "date", row.renewal || "2026-08-09")}${field("القيمة الإجمالية", "total", "text", row.total || "0 ر.س")}
    <label class="field"><span>الحالة</span><select class="select" name="status">${["نشط", "تنتهي قريبًا", "متأخر", "تم التجديد"].map((s) => `<option ${row.status === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
    <label class="field"><span>احتمالية عدم التجديد</span><select class="select" name="risk">${["منخفض", "متوسط", "مرتفع"].map((s) => `<option ${row.risk === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
    <div class="inline-actions"><button class="btn btn-primary">حفظ</button><button type="button" class="btn btn-secondary" data-action="close-modal">إلغاء</button></div>
  </form>`;
}

function exportCsv(filename, rows) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
  toast("تم تصدير الملف بنجاح");
}

async function copyText(text, message = "تم نسخ رابط التجديد") {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  toast(message);
}

function handleAction(target) {
  const action = target.dataset.action;
  if (!action) return;
  if (action === "toggle-public-nav") { state.navOpen = !state.navOpen; render(); }
  if (action === "toggle-sidebar") { state.sidebarOpen = !state.sidebarOpen; render(); }
  if (action === "close-modal") closePortal();
  if (action === "theme") {
    state.theme = state.theme === "dark" ? "light" : "dark";
    storage.set("renewpilot.theme", state.theme);
    applyPreferences();
    toast(state.theme === "dark" ? "تم تفعيل الوضع الليلي" : "تم تفعيل الوضع الشمسي");
    render();
  }
  if (action === "language") {
    state.language = state.language === "ar" ? "en" : "ar";
    storage.set("renewpilot.language", state.language);
    applyPreferences();
    toast(state.language === "ar" ? "تم تفعيل الواجهة العربية" : "English interface enabled");
    render();
  }
  if (action === "create-device-qr") {
    state.linkedDevice = {
      ...state.linkedDevice,
      status: "pending_qr",
      instanceId: state.linkedDevice.instanceId || `evo-${Date.now()}`,
      instanceName: "tenant-main-whatsapp",
      pairingCode: `WP-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      qrActive: true,
      qrExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }),
      activity: ["تم إنشاء جلسة Evolution API", "تم تجهيز باركود الاقتران"]
    };
    persistLinkedDevice();
    toast("تم إنشاء باركود جديد عبر Evolution API");
    render();
  }
  if (action === "show-device-qr") {
    openModal("باركود ربط واتساب", `<div class="qr-box active modal-qr"><div class="qr-grid">${Array.from({ length: 49 }).map((_, index) => `<span class="${index % 4 === 0 || [5, 11, 17, 23, 29, 35, 41].includes(index) ? "active" : ""}"></span>`).join("")}</div><strong>${state.linkedDevice.qrActive ? "امسح الباركود من واتساب" : "أنشئ باركود جديد أولا"}</strong><p class="muted">تتم عملية الربط من الخادم ولا يتم كشف EVOLUTION_API_KEY.</p></div>`, `<button class="btn btn-primary" data-action="create-device-qr">إنشاء باركود جديد</button><button class="btn btn-secondary" data-action="close-modal">إغلاق</button>`);
  }
  if (action === "copy-pairing") copyText(state.linkedDevice.pairingCode || defaultLinkedDevice.pairingCode, "تم نسخ رمز الاقتران");
  if (action === "confirm-device-link") {
    state.linkedDevice = {
      ...state.linkedDevice,
      status: "connected",
      qrActive: false,
      deviceName: "WhatsApp iPhone 15 Pro",
      phoneNumber: "+966 5X XXX XXXX",
      lastActivity: "منذ دقيقتين",
      activity: ["تم الربط بنجاح", "تم فحص الاتصال", "آخر مزامنة منذ دقيقتين"]
    };
    persistLinkedDevice();
    toast("تم ربط حساب واتساب بنجاح");
    render();
  }
  if (action === "check-device-connection") {
    if (!["pending_qr", "connected"].includes(state.linkedDevice.status)) return toast("أنشئ جلسة ربط أولا", "warning");
    if (state.linkedDevice.status === "pending_qr") return toast("الجلسة جاهزة، امسح الباركود من واتساب", "warning");
    state.linkedDevice.lastActivity = "الآن";
    state.linkedDevice.activity = ["تم فحص الاتصال بنجاح", ...(state.linkedDevice.activity || []).slice(0, 4)];
    persistLinkedDevice();
    toast("الاتصال يعمل بنجاح");
    render();
  }
  if (action === "send-device-test") {
    if (state.linkedDevice.status !== "connected") return toast("لا يمكن الإرسال قبل ربط الجهاز", "danger");
    state.linkedDevice.activity = ["تم إرسال رسالة اختبار عبر Evolution", ...(state.linkedDevice.activity || []).slice(0, 4)];
    persistLinkedDevice();
    toast("تم إرسال رسالة اختبار بنجاح");
    render();
  }
  if (action === "disconnect-device") {
    state.linkedDevice = { ...state.linkedDevice, status: "disconnected", qrActive: false, activity: ["تم فصل الجهاز", ...(state.linkedDevice.activity || []).slice(0, 4)] };
    persistLinkedDevice();
    toast("تم فصل الجهاز");
    render();
  }
  if (action === "delete-device") {
    state.linkedDevice = { ...defaultLinkedDevice, pairingCode: state.linkedDevice.pairingCode || defaultLinkedDevice.pairingCode };
    persistLinkedDevice();
    toast("تم حذف الجهاز المرتبط");
    render();
  }
  if (action === "notifications") toast("لديك 3 تنبيهات تحتاج مراجعة");
  if (action === "open-demo") openModal("احجز عرضًا توضيحيًا", demoForm());
  if (action === "billing") { state.billing = target.dataset.billing; storage.set("renewpilot.billing", state.billing); render(); }
  if (action === "select-plan") navigate(`/login?plan=${target.dataset.plan}`);
  if (action === "forgot-password") openModal("استعادة كلمة المرور", `<form data-submit="forgot" class="grid">${field("البريد الإلكتروني", "email", "email")}<button class="btn btn-primary">إرسال رابط الاستعادة</button></form>`);
  if (action === "google-login") toast("سيتم ربط تسجيل الدخول عبر Google لاحقًا", "warning");
  if (action === "open-ticket") openModal("فتح تذكرة دعم", `<form data-submit="ticket" class="grid">${field("الموضوع", "subject")}${field("البريد", "email", "email")}<textarea class="textarea" name="body" required placeholder="وصف المشكلة"></textarea><button class="btn btn-primary">إرسال التذكرة</button></form>`);
  if (action === "open-chat") openDrawer("الدردشة المباشرة", `<div class="activity-list"><div class="activity-item">${icon("د")}<div><strong>فريق الدعم</strong><p class="muted">مرحبًا، كيف يمكننا مساعدتك؟</p></div></div></div><form data-submit="chat"><input class="input" name="message" required placeholder="اكتب رسالتك"><br><br><button class="btn btn-primary">إرسال</button></form>`);
  if (action === "open-email") location.href = "mailto:support@renewpilot.ai?subject=طلب دعم RenewPilot AI";
  if (action === "open-whatsapp") window.open("https://wa.me/966500000000?text=مرحبًا، أحتاج دعم RenewPilot AI", "_blank");
  if (action === "knowledge") toast(`تم فتح قسم ${target.dataset.term}`);
  if (action === "support-chip") { state.search = target.dataset.term; render(); }
  if (action === "add-subscription") openModal("إضافة اشتراك جديد", subscriptionForm());
  if (action === "add-customer") openModal("إضافة عميل", customerForm());
  if (action === "columns") toast("تم تثبيت أعمدة الجدول الحالية");
  if (action === "apply-filter") toast("تم تطبيق الفلترة");
  if (action === "export-subscriptions") exportCsv("subscriptions.csv", [["رقم الطلب", "العميل", "الباقة", "الحالة"], ...state.subscriptions.map((r) => [r.order, r.customer, r.plan, r.status])]);
  if (action === "export-renewals") exportCsv("renewals.csv", [["العميل", "الخدمة", "المبلغ", "التاريخ"], ...renewals.map((r) => [r.customer, r.service, r.amount, r.due])]);
  if (action === "export-report") exportCsv("report.csv", [["المؤشر", "القيمة"], ...metrics.reports.map((m) => [m.title, m.value])]);
  if (action === "copy-renewal") copyText(target.dataset.linkValue);
  if (action === "renew-now") openModal("تأكيد التجديد", `<p>هل تريد فتح عملية التجديد الآن؟</p>`, `<button class="btn btn-primary" data-action="confirm-renew">تجديد الآن</button><button class="btn btn-secondary" data-action="close-modal">إلغاء</button>`);
  if (action === "confirm-renew") { closePortal(); toast("تم تجهيز رابط التجديد"); }
  if (action === "subscription-details") {
    const row = state.subscriptions.find((item) => item.order === target.dataset.key);
    if (row) openDrawer("تفاصيل الاشتراك", subscriptionDetails(row));
  }
  if (action === "subscription-edit") {
    const row = state.subscriptions.find((item) => item.order === target.dataset.key);
    if (row) openModal("تعديل الاشتراك", subscriptionForm(row, row.order));
  }
  if (action === "subscription-delete") {
    state.subscriptions = state.subscriptions.filter((item) => item.order !== target.dataset.key);
    storage.set("renewpilot.subscriptions", state.subscriptions);
    toast("تم حذف الاشتراك");
    render();
  }
  if (action === "customer-details") {
    const row = state.customers.find((item) => item.email === target.dataset.key);
    if (row) openDrawer("تفاصيل العميل", customerDetails(row));
  }
  if (action === "customer-edit") {
    const row = state.customers.find((item) => item.email === target.dataset.key);
    if (row) openModal("تعديل عميل", customerForm(row, row.email));
  }
  if (action === "customer-delete") {
    state.customers = state.customers.filter((item) => item.email !== target.dataset.key);
    storage.set("renewpilot.customers", state.customers);
    toast("تم حذف العميل");
    render();
  }
  if (action === "send-message") openModal("إرسال رسالة", `<form data-submit="message" class="grid">${field("المستلم", "to")}${field("نص الرسالة", "message")}<button class="btn btn-primary">إرسال</button></form>`);
  if (action === "send-renewal-link") openModal("تأكيد إرسال رابط التجديد", `<p>سيتم إرسال رابط التجديد إلى ${target.dataset.customer}.</p>`, `<button class="btn btn-primary" data-action="send-alert">إرسال</button><button class="btn btn-secondary" data-action="close-modal">إلغاء</button>`);
  if (action === "send-alert") { closePortal(); toast("تم إرسال التنبيه"); }
  if (action === "follow-customer") openDrawer("سجل المتابعة", `<p class="muted">${target.dataset.customer}</p>${activityList()}`);
  if (action === "notification-tab") { state.notificationTab = target.dataset.tab; render(); }
  if (action === "edit-template") openModal("تعديل القالب", `<form data-submit="template" class="grid"><textarea class="textarea" name="template" required>مرحبًا {{name}}، اشتراكك ينتهي قريبًا. جدد الآن من الرابط الآمن.</textarea><button class="btn btn-primary">حفظ القالب</button></form>`);
  if (["preview-template", "suggest-template", "message-view", "add-rule", "date-filter", "report-details", "all-insights", "show-ai-tips", "manage-integrations", "manage-team", "manage-billing"].includes(action)) openModal(target.textContent.trim() || "تفاصيل", `<p class="muted">تم فتح الإجراء المطلوب بنجاح، وسيتم ربطه بالنظام الخلفي لاحقًا.</p>`, `<button class="btn btn-primary" data-action="close-modal">تم</button>`);
  if (action === "resend-message") {
    const message = state.notifications.find((item) => item.recipient === target.dataset.key);
    if (message) message.status = "قيد الانتظار";
    storage.set("renewpilot.notifications", state.notifications);
    toast("تمت إعادة الرسالة إلى قيد الانتظار");
    render();
  }
  if (action === "new-warranty") openModal("إنشاء حالة ضمان", `<form data-submit="warranty" class="form-grid">${field("رقم الحالة", "id", "text", `WR-${Math.floor(2300 + Math.random() * 90)}`)}${field("العميل", "customer")}${field("نوع الخدمة", "service")}${field("نوع المشكلة", "issue")}<button class="btn btn-primary">حفظ الحالة</button></form>`);
  if (action === "case-details") openDrawer("تفاصيل الحالة الكاملة", caseDetail(state.warrantyCases[target.dataset.index]));
  if (["case-options", "apply-warranty-suggestion", "add-note", "update-case"].includes(action)) toast("تم تنفيذ الإجراء على الحالة");
  if (action === "copy-ai-message") copyText("مرحبًا، اشتراكك ينتهي قريبًا. يمكنك التجديد الآن من رابطك الآمن.");
  if (action === "save-settings") { storage.set("renewpilot.settings", state.settings); toast("تم حفظ التغييرات بنجاح"); }
  if (action === "change-password") openModal("تغيير كلمة المرور", `<form data-submit="password" class="grid">${field("كلمة المرور الحالية", "old", "password")}${field("كلمة المرور الجديدة", "new", "password")}<button class="btn btn-primary">حفظ</button></form>`);
}

function subscriptionDetails(row) {
  return `<div class="grid"><p><strong>${row.order}</strong> · ${row.customer}</p><p>${row.service} · ${row.plan}</p><p>من ${row.start} إلى ${row.end}</p>${status(row.status)}<button class="btn btn-primary" data-action="copy-renewal" data-link-value="${row.renewal}">نسخ رابط التجديد</button></div>`;
}

function customerDetails(row) {
  return `<div class="grid">
    <p><strong>${row.name}</strong></p><p class="muted">${row.email} · ${row.phone}</p>
    <div class="grid grid-3"><div class="mini-stat"><span>الباقة</span><strong>${row.plan}</strong></div><div class="mini-stat"><span>التجديد</span><strong>${row.renewal}</strong></div><div class="mini-stat"><span>الخطر</span><strong>${row.risk}</strong></div></div>
    <h3>سجل الرسائل</h3>${activityList()}
    <button class="btn btn-primary" data-action="send-message">إرسال رسالة</button>
    <button class="btn btn-secondary" data-link="/dashboard/subscriptions">عرض الاشتراكات</button>
  </div>`;
}

function handleSubmit(form, event) {
  event.preventDefault();
  const type = form.dataset.submit;
  const data = Object.fromEntries(new FormData(form));
  if (type === "login") {
    if (!data.email) return toast("يرجى إدخال البريد الإلكتروني", "danger");
    if (!data.password) return toast("يرجى إدخال كلمة المرور", "danger");
    toast("تم تسجيل الدخول بنجاح");
    navigate("/dashboard");
  }
  if (type === "subscription") {
    const editKey = form.dataset.editKey;
    if (editKey) {
      state.subscriptions = state.subscriptions.map((item) => item.order === editKey ? data : item);
    } else {
      state.subscriptions.unshift(data);
    }
    storage.set("renewpilot.subscriptions", state.subscriptions);
    closePortal();
    toast(editKey ? "تم تحديث الاشتراك بنجاح" : "تمت إضافة الاشتراك بنجاح");
    render();
  }
  if (type === "customer") {
    const editKey = form.dataset.editKey;
    if (editKey) {
      state.customers = state.customers.map((item) => item.email === editKey ? data : item);
    } else {
      state.customers.unshift(data);
    }
    storage.set("renewpilot.customers", state.customers);
    closePortal();
    toast(editKey ? "تم تحديث العميل بنجاح" : "تمت إضافة العميل بنجاح");
    render();
  }
  if (type === "warranty") {
    state.warrantyCases.unshift({ ...data, priority: "متوسطة", status: "مفتوحة", updated: "الآن" });
    storage.set("renewpilot.warranty", state.warrantyCases);
    closePortal();
    toast("تم إنشاء حالة الضمان");
    render();
  }
  if (["demo", "ticket", "chat", "message", "template", "forgot", "password", "ai-question"].includes(type)) {
    closePortal();
    toast(type === "ai-question" ? "تم استلام سؤالك، سيتم ربط المساعد الذكي لاحقًا." : "تم حفظ البيانات بنجاح");
  }
}

function render() {
  applyPreferences();
  state.route = location.pathname;
  state.query = new URLSearchParams(location.search);
  if (state.route.startsWith("/dashboard")) {
    const pages = {
      "/dashboard": dashboardHome,
      "/dashboard/subscriptions": subscriptionsPage,
      "/dashboard/customers": customersPage,
      "/dashboard/renewals": renewalsPage,
      "/dashboard/notifications": notificationsPage,
      "/dashboard/warranty": warrantyPage,
      "/dashboard/reports": reportsPage,
      "/dashboard/connected-devices": connectedDevicesPage,
      "/dashboard/settings": settingsPage
    };
    app.innerHTML = (pages[state.route] || dashboardHome)();
    return;
  }
  const pages = {
    "/": homePage,
    "/features": featuresPage,
    "/pricing": pricingPage,
    "/support": supportPage,
    "/login": loginPage,
    "/register": loginPage
  };
  app.innerHTML = (pages[state.route] || homePage)();
}

document.addEventListener("click", (event) => {
  const link = event.target.closest("[data-link]");
  if (link) {
    event.preventDefault();
    navigate(link.dataset.link);
    return;
  }
  const action = event.target.closest("[data-action]");
  if (action) handleAction(action);
});

document.addEventListener("submit", (event) => {
  const form = event.target.closest("[data-submit]");
  if (form) handleSubmit(form, event);
});

document.addEventListener("input", (event) => {
  const target = event.target;
  if (target.dataset.action === "dashboard-search" || target.dataset.action === "global-search" || target.dataset.action === "support-search") {
    state.search = target.value;
    if (target.dataset.action !== "global-search") render();
  }
});

document.addEventListener("change", (event) => {
  const target = event.target;
  if (target.dataset.action === "dashboard-filter") {
    state.filter = target.value;
    render();
  }
  if (target.dataset.action === "automation-toggle") {
    state.automation[target.dataset.key] = target.checked;
    storage.set("renewpilot.automation", state.automation);
    toast(target.checked ? "تم تفعيل القاعدة" : "تم إيقاف القاعدة");
  }
  if (target.dataset.action === "setting-toggle") {
    state.settings[target.dataset.key] = target.checked;
    storage.set("renewpilot.settings", state.settings);
    toast("تم تحديث الإعداد");
  }
});

window.addEventListener("popstate", render);
render();
