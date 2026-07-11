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
const localPreview = ["127.0.0.1", "localhost"].includes(location.hostname);
const e2ePreview = window.__RENEWPILOT_E2E_PREVIEW__ === true;
let authenticatedSession = location.pathname.startsWith("/dashboard") && !e2ePreview;

const localeMessages = Object.fromEntries(await Promise.all(["ar", "en"].map(async (locale) => {
  const response = await fetch(`/app/locales/${locale}.json`);
  if (!response.ok) throw new Error(`Unable to load ${locale} locale`);
  return [locale, await response.json()];
})));

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

function readPreference(key, legacyKey, fallback) {
  const direct = localStorage.getItem(key);
  if (direct === "ar" || direct === "en" || direct === "light" || direct === "dark") return direct;
  const legacy = storage.get(legacyKey, fallback);
  localStorage.setItem(key, legacy);
  return legacy;
}

function getNestedValue(object, key) {
  return key.split(".").reduce((value, part) => value?.[part], object);
}

function t(key, variables = {}) {
  const value = getNestedValue(localeMessages[state?.language || "ar"], key) || getNestedValue(localeMessages.ar, key) || key;
  return Object.entries(variables).reduce((text, [name, replacement]) => text.replaceAll(`{{${name}}}`, replacement), value);
}

function translatedPhrase(value) {
  if (state.language !== "en") return value;
  const source = String(value || "");
  const trimmed = source.trim();
  if (!trimmed || !/[\u0600-\u06FF]/.test(trimmed)) return source;
  const prefix = trimmed.match(/^[^\u0600-\u06FF]*/)?.[0] || "";
  const core = trimmed.slice(prefix.length);
  const translated = localeMessages.en.phrases?.[trimmed] || localeMessages.en.phrases?.[core];
  if (translated) return source.replace(trimmed, `${localeMessages.en.phrases?.[trimmed] ? "" : prefix}${translated}`);
  let composed = trimmed;
  for (const [arabic, english] of Object.entries(localeMessages.en.phrases || {}).sort((a, b) => b[0].length - a[0].length)) {
    if (composed.includes(arabic)) composed = composed.replaceAll(arabic, english);
  }
  if (!/[\u0600-\u06FF]/.test(composed)) return source.replace(trimmed, composed);
  return source.replace(/[\u0600-\u06FF][\u0600-\u06FF\s،؛؟ًٌٍَُِّْـ()-]*/g, t("common.untranslated"));
}

function localizeElement(root) {
  if (!root || state.language !== "en") return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (node.parentElement?.closest("script,style")) continue;
    node.nodeValue = translatedPhrase(node.nodeValue);
  }
  root.querySelectorAll("[placeholder],[title],[aria-label]").forEach((element) => {
    for (const attribute of ["placeholder", "title", "aria-label"]) {
      if (element.hasAttribute(attribute)) element.setAttribute(attribute, translatedPhrase(element.getAttribute(attribute)));
    }
  });
}

const defaultLinkedDevice = {
  status: "not_connected",
  linkMethod: "qr",
  instanceId: "",
  instanceName: "",
  deviceName: "",
  phoneNumber: "",
  phoneInput: "",
  pairingCode: "WP-7K4M-9Q2P",
  pairingSupported: true,
  qrActive: false,
  qrExpiresAt: "",
  pairingExpiresAt: "",
  lastActivity: "",
  lastCheckAt: "",
  lastSendAt: "",
  messagesToday: 0,
  messagesMonth: 0,
  safetyScore: 96,
  queuedMessages: 0,
  alerts: [],
  activity: []
};

const state = {
  route: location.pathname,
  query: new URLSearchParams(location.search),
  navOpen: false,
  sidebarOpen: false,
  theme: readPreference("renewpilot_theme", "renewpilot.theme", "light"),
  language: readPreference("renewpilot_locale", "renewpilot.language", "ar"),
  profileOpen: false,
  resetStep: 1,
  resetEmail: "",
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
  ["/", "sidebar.home"],
  ["/features", "public.features"],
  ["/pricing", "public.pricing"],
  ["/support", "public.support"]
];

const dashboardRoutes = [
  ["/dashboard", "sidebar.home", "⌂"],
  ["/dashboard/subscriptions", "sidebar.subscriptions", "▣"],
  ["/dashboard/customers", "sidebar.customers", "♙"],
  ["/dashboard/renewals", "sidebar.renewals", "↻"],
  ["/dashboard/notifications", "sidebar.notifications", "♢"],
  ["/dashboard/connected-devices", "sidebar.linkedDevices", "🔗"],
  ["/dashboard/whatsapp-safety", "sidebar.whatsappSafety", "◉"],
  ["/dashboard/unsubscribe", "sidebar.unsubscribe", "⊘"],
  ["/dashboard/warranty", "sidebar.warrantyCenter", "◇"],
  ["/dashboard/reports", "sidebar.reports", "▥"],
  ["/dashboard/activity", "sidebar.activity", "◷"],
  ["/dashboard/billing", "sidebar.billing", "▤"],
  ["/dashboard/settings", "sidebar.settings", "⚙"]
];

function applyPreferences() {
  document.documentElement.dataset.theme = state.theme;
  document.documentElement.lang = state.language;
  document.documentElement.dir = state.language === "ar" ? "rtl" : "ltr";
}

function persistLinkedDevice() {
  const { qrBase64: _temporaryQr, ...persisted } = state.linkedDevice;
  storage.set("renewpilot.linkedDevice", persisted);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || payload.error || "Request failed");
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function ensureEvolutionInstance() {
  if (state.linkedDevice.instanceId) return state.linkedDevice;
  const payload = await fetchJson("/api/whatsapp/instances/create", { method: "POST" });
  state.linkedDevice = {
    ...state.linkedDevice,
    ...payload.instance,
    instanceId: payload.instance?.id,
    instanceName: payload.instance?.instanceName || "",
    qrBase64: payload.instance?.qrBase64 || ""
  };
  persistLinkedDevice();
  return state.linkedDevice;
}

async function syncLinkedDevice() {
  if (localPreview || state.deviceSyncing) return;
  state.deviceSyncing = true;
  try {
    const response = await fetch("/api/whatsapp/instances/create");
    if (!response.ok) return;
    const payload = await response.json();
    if (payload.instance) {
      state.linkedDevice = { ...state.linkedDevice, ...payload.instance, instanceId: payload.instance.id };
      persistLinkedDevice();
      render();
    }
  } finally {
    state.deviceSyncing = false;
  }
}

async function browserSessionIsValid() {
  try {
    const response = await fetch("/api/auth/session", { cache: "no-store" });
    return response.ok;
  } catch {
    return false;
  }
}

async function navigate(to) {
  const url = new URL(to, location.origin);
  if (url.pathname.startsWith("/dashboard") && !e2ePreview && !authenticatedSession) {
    authenticatedSession = await browserSessionIsValid();
    if (!authenticatedSession) {
      history.pushState({}, "", "/login");
      state.route = "/login";
      render();
      toast(t("auth.invalidCredentials"), "danger");
      return;
    }
  }
  history.pushState({}, "", url.pathname + url.search);
  state.route = url.pathname;
  state.query = url.searchParams;
  state.navOpen = false;
  state.sidebarOpen = false;
  state.profileOpen = false;
  state.search = "";
  state.filter = "الكل";
  render();
  if (["/dashboard/connected-devices", "/dashboard/linked-devices"].includes(state.route)) void syncLinkedDevice();
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
  const destination = state.route.startsWith("/dashboard") ? "/dashboard" : "/";
  return `<button class="brand btn-ghost" data-link="${destination}" aria-label="RenewPilot AI">
    <span class="brand-mark">R</span><span>RenewPilot AI</span>
  </button>`;
}

function publicNavbar() {
  const links = routes.map(([path, key]) => `<button class="nav-link ${state.route === path ? "active" : ""}" data-link="${path}">${t(key)}</button>`).join("");
  const themeIcon = state.theme === "dark" ? "☾" : "☀";
  return `<nav class="public-nav ${state.navOpen ? "open" : ""}">
    <div class="container nav-inner">
      ${logo()}
      <div class="nav-links">${links}</div>
      <div class="nav-actions">
        <button class="btn btn-ghost icon-btn" data-action="theme" title="${t("settings.theme")}">${themeIcon}</button>
        <button class="btn btn-secondary" data-action="language">${state.language === "ar" ? "EN" : "AR"}</button>
        <button class="btn btn-secondary" data-link="/login">${t("auth.loginTitle")}</button>
        <button class="btn btn-primary" data-link="/register">${t("auth.createAccount")}</button>
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
    ${icon(state.language === "en" ? "•" : item.title.slice(0, 1), item.tone === "purple" ? "purple" : "")}
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
        ].map(([title, body, btn, action], i) => `<article class="card support-card">${icon(state.language === "en" ? "•" : title.slice(0, 1), i === 1 ? "green" : i === 2 ? "purple" : i === 3 ? "orange" : "")}<h3>${title}</h3><p class="muted">${body}</p><button class="btn btn-secondary" data-action="${action}">${btn}</button></article>`).join("")}
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
  const isRegister = state.route === "/register";
  return `<main class="auth-page ${isRegister ? "register-mode" : "login-mode"}">
    <div class="auth-brand">${logo()}</div>
    <div class="auth-top-actions">
      <button class="btn btn-ghost icon-btn" data-action="theme" title="${t("settings.theme")}">${state.theme === "dark" ? "☾" : "☀"}</button>
      <button class="btn btn-secondary" data-action="language">${state.language === "ar" ? "EN" : "AR"}</button>
    </div>
    <section class="auth-shell">
      <article class="card auth-panel">
        <span class="eyebrow">RenewPilot AI</span>
        <h1>${t(isRegister ? "auth.registerTitle" : "auth.loginTitle")}</h1>
        <p class="lead">${t(isRegister ? "auth.registerSubtitle" : "auth.loginSubtitle")}</p>
        ${state.query.get("plan") ? `<p class="badge">الخطة المختارة: ${state.query.get("plan")}</p>` : ""}
        <form data-submit="${isRegister ? "register" : "login"}" class="grid auth-form" novalidate>
          ${isRegister ? `<label class="field"><span>${t("auth.name")}</span><input class="input" type="text" name="name" autocomplete="name" required></label>` : ""}
          <label class="field"><span>${t("auth.email")}</span><input class="input" type="email" name="email" placeholder="you@example.com" autocomplete="email" required></label>
          <label class="field"><span>${t("auth.password")}</span><input class="input" type="password" name="password" autocomplete="${isRegister ? "new-password" : "current-password"}" required></label>
          ${isRegister ? `<label class="field"><span>${t("auth.confirmPassword")}</span><input class="input" type="password" name="confirmPassword" autocomplete="new-password" required></label>` : `<div class="inline-actions split-between"><label class="remember"><input type="checkbox" name="remember" checked> ${t("auth.remember")}</label><button type="button" class="btn btn-ghost" data-link="/forgot-password">${t("auth.forgotPassword")}</button></div>`}
          <button class="btn btn-primary auth-submit">${t(isRegister ? "auth.register" : "auth.login")} <span>→</span></button>
          <p class="auth-switch">${t(isRegister ? "auth.hasAccount" : "auth.noAccount")} <button type="button" class="link-button" data-link="${isRegister ? "/login" : "/register"}">${t(isRegister ? "auth.loginLink" : "auth.createAccount")}</button></p>
        </form>
      </article>
      <aside class="auth-visual">
        <div class="auth-hero-logo"><span class="brand-mark">R</span><strong>RenewPilot <b>AI</b></strong></div>
        <p>${state.language === "ar" ? "الطريقة الذكية لإدارة التجديدات بثقة وأمان." : "The intelligent way to manage renewals. Track. Automate. Renew with confidence."}</p>
        <div class="auth-dashboard-art">
          <div class="art-top"><strong>${t("dashboard.title")}</strong><span></span></div>
          <div class="art-stats">${["1,248,750", "324", "98", "23"].map((value) => `<span><small>${state.language === "ar" ? "الإجمالي" : "Total"}</small><strong>${value}</strong></span>`).join("")}</div>
          <div class="art-table">${(state.language === "ar" ? ["اشتراك احترافي", "باقة أعمال", "خدمة المركبات", "خدمة رقمية"] : ["Professional Indemnity", "Commercial Property", "Motor Fleet", "Cyber Insurance"]).map((item, index) => `<div><span>${item}</span><b>${index === 2 ? (state.language === "ar" ? "قريب" : "Due Soon") : t("common.active")}</b></div>`).join("")}</div>
        </div>
        <div class="auth-feature-row">
          <span>🔔 ${state.language === "ar" ? "تنبيهات ذكية" : "Smart Reminders"}</span><span>↻ ${state.language === "ar" ? "تتبع التجديد" : "Renewal Tracking"}</span><span>👥 ${state.language === "ar" ? "بوابة العملاء" : "Customer Portal"}</span>
        </div>
        <div class="auth-security-note">${state.language === "ar" ? "مصمم للأمان والثقة." : "Built for security. Designed for trust."}</div>
      </aside>
    </section>
  </main>`;
}

function forgotPasswordPage() {
  const step = state.resetStep;
  const content = step === 1
    ? `<form data-submit="forgot" class="grid auth-form" novalidate><label class="field"><span>${t("auth.email")}</span><input class="input" type="email" name="email" value="${state.resetEmail}" autocomplete="email"></label><button class="btn btn-primary auth-submit">${t("auth.sendCode")}</button></form>`
    : step === 2
      ? `<form data-submit="reset-password" class="grid auth-form" novalidate><label class="field"><span>${t("auth.code")}</span><input class="input code-input" name="code" inputmode="numeric" maxlength="6"></label><label class="field"><span>${t("auth.newPassword")}</span><input class="input" type="password" name="password" autocomplete="new-password"></label><label class="field"><span>${t("auth.confirmPassword")}</span><input class="input" type="password" name="confirmPassword" autocomplete="new-password"></label><button class="btn btn-primary auth-submit">${t("auth.resetPassword")}</button></form>`
      : `<div class="auth-success"><span class="success-mark">✓</span><p>${t("auth.passwordChanged")}</p><button class="btn btn-primary" data-link="/login">${t("auth.loginTitle")}</button></div>`;
  return `<main class="auth-page reset-mode"><div class="auth-brand">${logo()}</div><div class="auth-top-actions"><button class="btn btn-ghost icon-btn" data-action="theme">${state.theme === "dark" ? "☾" : "☀"}</button><button class="btn btn-secondary" data-action="language">${state.language === "ar" ? "EN" : "AR"}</button></div><section class="auth-shell single-auth"><article class="card auth-panel"><span class="eyebrow">RenewPilot AI</span><h1>${t("auth.forgotTitle")}</h1><p class="lead">${step === 1 ? t("auth.forgotSubtitle") : step === 2 ? t("auth.codeSent") : t("auth.passwordChanged")}</p>${content}<button class="btn btn-ghost" data-link="/login">${t("auth.loginLink")}</button></article></section></main>`;
}

function dashboardShell(content) {
  const links = dashboardRoutes.map(([path, key, mark]) => `<button class="side-link ${state.route === path ? "active" : ""}" data-link="${path}"><span>${mark}</span>${t(key)}</button>`).join("");
  const themeIcon = state.theme === "dark" ? "☾" : "☀";
  return `<div class="dashboard-shell">
    <aside class="sidebar ${state.sidebarOpen ? "open" : ""}">
      ${logo()}
      <nav class="side-links">${links}</nav>
      <div class="ai-side"><strong>${t("dashboard.assistant")}</strong><p class="muted">${t("dashboard.assistantText")}</p><button class="btn btn-secondary" data-action="show-ai-tips">${state.language === "ar" ? "عرض الاقتراحات" : "View suggestions"}</button></div>
    </aside>
    <main class="dashboard-main">
      <header class="topbar">
        <div class="topbar-tools">
          <button class="btn btn-secondary icon-btn mobile-side-toggle" data-action="toggle-sidebar">☰</button>
          <div class="search-wrap"><span class="search-icon">⌕</span><input class="input" data-action="global-search" placeholder="${t("dashboard.search")}" value="${state.search}"></div>
        </div>
        <div class="topbar-tools">
          <span class="badge">Pro Plan</span>
          <button class="btn btn-ghost icon-btn" data-action="notifications">🔔</button>
          <button class="btn btn-ghost icon-btn" data-action="theme">${themeIcon}</button>
          <button class="btn btn-secondary" data-action="language">${state.language === "ar" ? "EN" : "AR"}</button>
          <button class="profile-trigger" data-action="profile-menu"><span class="avatar">م</span><strong>${state.language === "ar" ? "محمد المدير" : "Mohammed, Admin"}</strong></button>
          ${state.profileOpen ? `<div class="profile-menu"><button data-link="/dashboard/settings">${t("dashboard.profile")}</button><button data-link="/dashboard/settings">${t("dashboard.settings")}</button><button class="danger-text" data-action="logout-confirm">${t("auth.logout")}</button></div>` : ""}
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
  return `<div class="page-title"><div><h1>${title}</h1><p class="muted">RenewPilot AI · ${t(state.theme === "dark" ? "settings.dark" : "settings.light")}</p></div><div class="toolbar">${actions}</div></div>`;
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
  return dashboardShell(`${pageTitle("إدارة الاشتراكات", `<button class="btn btn-primary" data-action="add-subscription">إضافة اشتراك جديد</button><button class="btn btn-secondary" data-action="bulk-import">لصق من Excel</button><button class="btn btn-secondary" data-action="columns">أعمدة</button><button class="btn btn-secondary" data-action="export-subscriptions">تصدير</button>`)}
    ${statGrid(metrics.subscriptions)}
    ${tableToolbar(["الكل", "نشط", "تنتهي قريبًا", "متأخر", "موقوف", "تم التجديد"])}
    <article class="card table-card">${rows.length ? subscriptionsTable(rows) : emptyState("لا توجد اشتراكات مطابقة")}</article>`);
}

function subscriptionsTable(rows, compact = false) {
  const head = compact ? ["رقم الطلب", "العميل", "الباقة", "الحالة", "الإجراء"] : ["رقم الطلب", "العميل", "الباقة", "تاريخ البداية", "تاريخ الانتهاء", "الحالة", "التجديد", "الإجراء"];
  const body = rows.map((row, index) => compact
    ? [row.order, row.customer, row.plan, status(row.status), `<button class="btn btn-secondary" data-action="renew-now" data-key="${row.order}">تجديد الآن</button>`]
    : [row.order, row.customer, row.plan, row.start, row.end, status(row.status), `<button class="btn btn-ghost" data-action="copy-renewal" data-link-value="${row.renewal}">نسخ الرابط</button>`, `<div class="inline-actions"><button class="btn btn-primary" data-action="mark-renewed" data-key="${row.order}">تم التجديد</button>${rowActions("subscription", row.order)}</div>`]).map((cells) => `<tr>${cells.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("");
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
    <section class="linked-layout" data-device-status="${device.status}" data-link-method="${method}">
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

function connectedDevicesCenterPage() {
  const device = { ...defaultLinkedDevice, ...state.linkedDevice };
  const isConnected = device.status === "connected";
  const isPendingQr = device.status === "pending_qr";
  const isPendingPairing = device.status === "pending_pairing";
  const method = device.linkMethod || "qr";
  const statusText = isConnected ? "متصل الآن" : isPendingQr ? "بانتظار مسح الباركود" : isPendingPairing ? "بانتظار إدخال رمز الاقتران" : device.status === "disconnected" ? "غير متصل" : "غير مربوط";
  const statusTone = isConnected ? "success" : isPendingQr || isPendingPairing ? "warning" : "danger";
  const qrCell = isPendingQr
    ? Array.from({ length: 49 }).map((_, index) => `<span class="${[0, 1, 7, 8, 40, 41, 48, 12, 18, 22, 24, 31, 35].includes(index) ? "active" : ""}"></span>`).join("")
    : Array.from({ length: 49 }).map((_, index) => `<span class="${index % 6 === 0 ? "ghost" : ""}"></span>`).join("");
  const qrImage = typeof device.qrBase64 === "string" && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(device.qrBase64)
    ? `<img class="qr-real" src="${device.qrBase64}" alt="باركود ربط واتساب">`
    : `<div class="qr-grid">${qrCell}</div>`;
  const activity = device.activity?.length ? device.activity : ["لا توجد أجهزة مرتبطة حتى الآن"];
  const alerts = device.alerts?.length ? device.alerts : ["وضع الإرسال الآمن مفعل افتراضيا", "أي رسالة اختبار تدخل message_queue قبل الإرسال"];
  const safeItems = ["20 رسالة في الساعة", "100 رسالة في اليوم", "تأخير 20 - 90 ثانية", "منع الإرسال من 9 مساء إلى 9 صباحا", "منع تكرار نفس الرسالة خلال 24 ساعة"];
  const connectedTable = simpleTable(["الجهاز", "رقم واتساب", "الحالة", "آخر فحص", "آخر إرسال", "الإجراءات"], [[device.deviceName || "WhatsApp Device", device.phoneNumber || "+966 5X XXX XXXX", status("نشط"), device.lastCheckAt || "لم يتم الفحص", device.lastSendAt || "لم يتم الإرسال", `<button class="btn btn-secondary" data-action="check-device-connection">فحص</button>`]]);

  return dashboardShell(`${pageTitle("الأجهزة المرتبطة", `<button class="btn btn-primary" data-action="create-device-qr">${isConnected ? "إعادة إنشاء الباركود" : "ربط واتساب"}</button>`)}
    <p class="linked-subtitle">قم بربط واتساب وإدارة أجهزتك المرتبطة بأمان لتواصل فعال مع عملائك.</p>
    <section class="linked-layout" data-device-status="${device.status}" data-link-method="${method}">
      <article class="card linked-main-card">
        <div class="device-art" aria-hidden="true">
          <div class="phone-frame"><span class="wa-logo">☎</span></div>
          <div class="wa-check ${isConnected ? "show" : ""}">✓</div>
          <div class="qr-float">${device.qrBase64 ? qrImage : `<div class="qr-mini">${qrCell}</div>`}</div>
        </div>
        <div class="link-panel">
          <div class="section-head compact-head">
            <div><h2>ربط واتساب</h2><p class="muted">${isConnected ? "تم ربط حساب واتساب وجاهز لإرسال تنبيهات وتجديدات العملاء." : "اربط حساب واتساب لإدارة المحادثات والرد على العملاء مباشرة من المنصة."}</p><p class="muted lock-line">🔒 آمن، خاص، ومتوافق مع سياسات واتساب.</p></div>
            <span class="status ${statusTone}">${statusText}</span>
          </div>
          <div class="tabs tabs-row link-tabs">
            <button class="tab ${method === "qr" ? "active" : ""}" data-action="device-link-method" data-method="qr">الربط بالباركود QR</button>
            <button class="tab ${method === "pairing" ? "active" : ""}" data-action="device-link-method" data-method="pairing">الربط برمز الاقتران</button>
          </div>
          ${method === "qr" ? `<div class="link-box-grid">
            <div class="qr-box ${isPendingQr ? "active" : ""}" data-action="show-device-qr">
              ${qrImage}
              <strong>${isPendingQr ? "الباركود جاهز للمسح" : isConnected ? "الجهاز متصل" : "سيظهر الباركود هنا"}</strong>
              <small class="muted">${isPendingQr ? `ينتهي خلال 60 ثانية - صالح حتى ${device.qrExpiresAt}` : "لا يتم حفظ QR فترة طويلة"}</small>
            </div>
            <div class="pair-code">
              <span class="muted">رمز الاقتران</span>
              <strong>${device.pairingCode}</strong>
              <small class="muted">صالح لمدة 15 دقيقة</small>
              <button class="btn btn-primary" data-action="create-device-qr">إنشاء/تحديث باركود</button>
              <button class="btn btn-secondary" data-action="copy-pairing">نسخ رمز الاقتران</button>
              <button class="btn btn-secondary" data-action="check-device-connection" ${!isPendingQr && !isConnected ? "disabled" : ""}>فحص الاتصال</button>
              ${isPendingQr && localPreview ? `<button class="btn btn-primary" data-action="confirm-device-link">تأكيد الربط التجريبي</button>` : ""}
            </div>
          </div>` : `<div class="link-box-grid pairing-layout">
            <div class="pairing-form">
              <label class="field"><span>رقم واتساب</span><input class="input" data-action="pairing-phone-input" value="${device.phoneInput || ""}" placeholder="9665XXXXXXXX" inputmode="numeric"></label>
              <small class="muted">اكتب الرقم بصيغة دولية بدون + أو مسافات، مثال: 9665XXXXXXXX.</small>
              <button class="btn btn-primary" data-action="create-pairing-code" ${device.pairingSupported === false ? "disabled" : ""}>إنشاء رمز الاقتران</button>
              ${device.pairingSupported === false ? `<p class="status warning">رمز الاقتران غير مدعوم حاليا في نسخة Evolution API المثبتة. استخدم الربط بالباركود.</p>` : ""}
            </div>
            <div class="pair-code pairing-result">
              <span class="muted">رمز الاقتران</span>
              <strong>${isPendingPairing ? device.pairingCode : "ABCD-EFGH"}</strong>
              <small class="muted">${isPendingPairing ? `ينتهي خلال 60 ثانية - صالح حتى ${device.pairingExpiresAt}` : "سيظهر الرمز بعد إدخال رقم صحيح"}</small>
              <button class="btn btn-secondary" data-action="copy-pairing" ${!isPendingPairing ? "disabled" : ""}>نسخ الرمز</button>
              ${localPreview ? `<button class="btn btn-primary" data-action="confirm-device-link" ${!isPendingPairing ? "disabled" : ""}>تأكيد الربط التجريبي</button>` : ""}
              <ul class="check-list"><li>اختر الربط برقم الهاتف في واتساب إذا ظهر لك.</li><li>أدخل رمز الاقتران الظاهر هنا.</li><li>انتظر حتى تصبح الحالة متصل.</li></ul>
            </div>
          </div>`}
          ${isConnected ? `<div class="inline-actions"><button class="btn btn-secondary" data-action="send-device-test">إرسال رسالة اختبار</button><button class="btn btn-danger" data-action="disconnect-device">فصل الجهاز</button><button class="btn btn-ghost" data-action="delete-device">حذف الجهاز</button></div>` : ""}
        </div>
      </article>
      <aside class="card link-steps-card">
        ${isConnected ? `<div class="success-device-state"><span>✓</span><h2>حساب واتساب متصل بنجاح</h2><p class="muted">حسابك جاهز لإرسال تنبيهات وتجديدات العملاء.</p><ul class="check-list"><li>جاهز لإرسال الرسائل</li><li>استقبال وإدارة الردود</li><li>مزامنة جهات الاتصال</li><li>تتبع نشاط المحادثات</li></ul></div>` : `<h2>طريقة الربط</h2>${[["1", "افتح واتساب على هاتفك", "افتح تطبيق واتساب على هاتفك الذكي."], ["2", "الأجهزة المرتبطة", "اذهب إلى الإعدادات ثم اختر الأجهزة المرتبطة."], ["3", "امسح الباركود أو أدخل رمز الاقتران", "اربط الجهاز ثم انتظر اكتمال الاتصال."]].map(([num, title, body]) => `<div class="step-row"><span>${num}</span><strong>${title}</strong><p class="muted">${body}</p></div>`).join("")}`}
        <div class="secure-note">تأكد من إبقاء واتساب مفتوحًا أثناء عملية الربط حتى تكتمل بنجاح.</div>
      </aside>
    </section>
    <section class="linked-bottom-grid">
      <article class="card usage-card"><span class="mini-icon">👥</span><h3>استخدام الأجهزة المرتبطة</h3><strong class="usage-count">1 / 1 جهاز مرتبط</strong><div class="usage-bar"><span style="width:${isConnected ? 100 : 8}%"></span></div><p class="${isConnected ? "success-text" : "danger-text"}">${isConnected ? "تم ربط جهاز واتساب بنجاح" : "لم يتم ربط أي جهاز بعد"}</p><button class="btn btn-ghost" data-link="/pricing">ترقية الخطة لزيادة الحد الأقصى</button></article>
      <article class="card table-card security-card"><span class="mini-icon">🛡</span><h3>ملاحظات الأمان</h3><ul class="check-list">${["الاتصال مشفر بالكامل بين منصتك وواتساب.", "لا يتم تخزين أو عرض أي رموز أو توكنات.", "عند انتهاء الجلسة، سيتم طلب إعادة الربط.", "أوقف أي جهاز غير معروف من إعدادات واتساب."].map((item) => `<li>${item}</li>`).join("")}</ul></article>
      <article class="card table-card linked-table-card"><h3>الأجهزة المرتبطة الأخيرة</h3>${isConnected ? connectedTable : `<div class="empty-device"><div class="empty-icon">🔗</div><strong>لا توجد أجهزة مرتبطة حتى الآن</strong><p class="muted">قم بربط واتساب لعرض الأجهزة المرتبطة وسجل النشاط.</p></div>`}</article>
      <article class="card table-card activity-card"><h3>النشاط الأخير</h3><div class="activity-list">${activity.map((item, index) => `<div class="activity-item">${icon(String(index + 1), isConnected ? "green" : "")}<div><strong>${item}</strong><p class="muted">${isConnected ? "تم التحديث الآن" : "بانتظار الربط"}</p></div></div>`).join("")}</div></article>
    </section>
    <section class="section section-tight health-and-safety"><article class="card table-card number-health-card"><div class="section-head"><div><h3>${t("linkedDevices.health")}</h3><p class="muted">${t("linkedDevices.safeSending")}</p></div><span class="health-score">${device.safetyScore || 96}/100</span></div><div class="health-metrics"><span><small>${t("linkedDevices.messagesToday")}</small><strong>${device.messagesToday || 0}</strong></span><span><small>${t("linkedDevices.messagesHour")}</small><strong>${device.messagesHour || 0}</strong></span><span><small>${t("linkedDevices.failureRate")}</small><strong>${device.failureRate || 0}%</strong></span><span><small>${t("linkedDevices.unsubscribeCount")}</small><strong>${device.unsubscribeCount || 0}</strong></span><span><small>${t("linkedDevices.riskScore")}</small><strong>${100 - (device.safetyScore || 96)}/100</strong></span></div><div class="secure-note"><strong>${t("linkedDevices.smartAdvice")}:</strong> ${state.language === "ar" ? "صحة الرقم مستقرة. استمر ضمن حدود التدرج ولا ترفع الإرسال اليومي فجأة." : "Number health is stable. Keep gradual sending limits and avoid sudden volume increases."}</div></article><article class="card table-card safe-mode-card"><h3>وضع الإرسال الآمن</h3><div class="safety-list">${safeItems.map((item) => `<span>${item}</span>`).join("")}</div></article></section>`);
}

function whatsappSafetyPage() {
  const warmup = [[1, 10], [2, 15], [3, 20], [4, 25], [5, 35], [7, 60], [14, 200]];
  return dashboardShell(`${pageTitle(t("sidebar.whatsappSafety"), `<button class="btn btn-primary" data-link="/dashboard/connected-devices">${t("sidebar.linkedDevices")}</button>`)}<div class="grid grid-3"><article class="card table-card"><h2>${t("linkedDevices.health")}</h2><div class="risk-ring"><strong>22</strong><span>/100</span></div><p class="status success">${state.language === "ar" ? "صحة الرقم جيدة" : "Number health is good"}</p></article><article class="card table-card"><h2>${state.language === "ar" ? "حدود الحماية" : "Protection limits"}</h2><ul class="check-list"><li>20 ${state.language === "ar" ? "رسالة في الساعة" : "messages per hour"}</li><li>100 ${state.language === "ar" ? "رسالة في اليوم" : "messages per day"}</li><li>${state.language === "ar" ? "منع التكرار لمدة 24 ساعة" : "24-hour duplicate protection"}</li><li>${state.language === "ar" ? "ساعات هدوء 9م - 9ص" : "Quiet hours 9 PM - 9 AM"}</li></ul></article><article class="card table-card"><h2>${t("linkedDevices.smartAdvice")}</h2><p>${state.language === "ar" ? "لا ترفع الإرسال اليومي اليوم؛ الرقم جديد ويحتاج تدرجًا." : "Do not increase today's sending volume; this number is still warming up."}</p></article></div><section class="section"><article class="card table-card"><h2>${state.language === "ar" ? "جدول التدرج التلقائي" : "Automatic warm-up schedule"}</h2><div class="warmup-track">${warmup.map(([day, limit]) => `<span><small>${state.language === "ar" ? "اليوم" : "Day"} ${day}</small><strong>${limit}</strong></span>`).join("")}</div></article></section>`);
}

function unsubscribePage() {
  const rows = [
    ["+966 50 123 4567", "إيقاف", "واتساب", "طلب المستخدم", "اليوم 10:22"],
    ["+966 55 987 6543", "stop", "واتساب", "إلغاء التنبيهات", "أمس 18:40"]
  ];
  return dashboardShell(`${pageTitle(t("sidebar.unsubscribe"), `<button class="btn btn-primary" data-action="add-unsubscribe">${state.language === "ar" ? "إضافة رقم" : "Add number"}</button>`)}<div class="grid grid-3"><article class="card stat-card"><div><span class="muted">${state.language === "ar" ? "إجمالي القائمة" : "Total opted out"}</span><strong>2</strong></div>${icon("⊘", "orange")}</article><article class="card table-card full-two"><h2>${t("sidebar.unsubscribe")}</h2>${simpleTable([state.language === "ar" ? "الرقم" : "Number", state.language === "ar" ? "الكلمة" : "Keyword", state.language === "ar" ? "المصدر" : "Source", state.language === "ar" ? "السبب" : "Reason", state.language === "ar" ? "التاريخ" : "Date"], rows)}</article></div>`);
}

function activityPage() {
  const items = ["تم إنشاء اشتراك جديد", "تم ربط واتساب", "عمل Cron للتجديدات", "تم إرسال رسالة تجديد", "تم تغيير إعدادات الحماية"];
  return dashboardShell(`${pageTitle(t("sidebar.activity"))}<article class="card table-card"><div class="activity-list">${items.map((item, index) => `<div class="activity-item">${icon(String(index + 1), index < 2 ? "green" : "")}<div><strong>${item}</strong><p class="muted">${state.language === "ar" ? `منذ ${index + 1} ساعة · محمد المدير` : `${index + 1} hour(s) ago · Mohammed, Admin`}</p></div></div>`).join("")}</div></article>`);
}

function billingPage() {
  return dashboardShell(`${pageTitle(t("sidebar.billing"))}<div class="grid grid-3">${pricingPlans.map((plan) => `<article class="card pricing-card ${plan.featured ? "featured" : ""}"><h2>${plan.name}</h2><div class="price">${plan.monthly} ${state.language === "ar" ? "ر.س / شهريًا" : "SAR / month"}</div><ul class="check-list">${plan.features.map((item) => `<li>${item}</li>`).join("")}</ul><button class="btn btn-primary" data-action="select-plan" data-plan="${plan.id}">${state.language === "ar" ? "اختيار الخطة" : "Choose plan"}</button></article>`).join("")}</div>`);
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
  return dashboardShell(`${pageTitle(t("settings.title"), `<button class="btn btn-primary" data-action="save-settings">${t("common.save")}</button>`)}
    <div class="grid grid-3"><article class="card settings-card session-card">${icon("↪", "orange")}<h3>${t("settings.sessionAccount")}</h3><p><strong>${state.language === "ar" ? "محمد المدير" : "Mohammed, Admin"}</strong><br><span class="muted">owner@example.com</span></p><p><span class="status success">${t("settings.active")}</span></p><button class="btn btn-danger" data-action="logout-confirm">${t("auth.logout")}</button></article>${sections.map(([title, body, action], i) => `<article class="card settings-card">
      ${icon(state.language === "en" ? "•" : title.slice(0, 1), i % 3 === 1 ? "purple" : i % 3 === 2 ? "green" : "")}
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
  portal.innerHTML = `<div class="modal-overlay" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true" tabindex="-1">
    <header class="modal-head"><h2>${title}</h2><button class="btn btn-ghost icon-btn" data-action="close-modal">×</button></header>
    <div class="modal-body">${body}</div>
    ${foot ? `<footer class="modal-foot">${foot}</footer>` : ""}
  </section></div>`;
  localizeElement(portal);
  portal.querySelector(".modal")?.focus();
}

function openDrawer(title, body) {
  portal.innerHTML = `<div class="drawer-overlay" data-action="close-modal"><aside class="drawer">
    <header class="modal-head"><h2>${title}</h2><button class="btn btn-ghost icon-btn" data-action="close-modal">×</button></header>
    <div class="modal-body">${body}</div>
  </aside></div>`;
  localizeElement(portal);
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

async function handleAction(target) {
  const action = target.dataset.action;
  if (!action) return;
  if (action === "toggle-public-nav") { state.navOpen = !state.navOpen; render(); }
  if (action === "toggle-sidebar") { state.sidebarOpen = !state.sidebarOpen; render(); }
  if (action === "close-modal") closePortal();
  if (action === "theme") {
    state.theme = state.theme === "dark" ? "light" : "dark";
    localStorage.setItem("renewpilot_theme", state.theme);
    applyPreferences();
    toast(state.theme === "dark" ? "تم تفعيل الوضع الليلي" : "تم تفعيل الوضع الشمسي");
    render();
  }
  if (action === "language") {
    state.language = state.language === "ar" ? "en" : "ar";
    localStorage.setItem("renewpilot_locale", state.language);
    applyPreferences();
    toast(state.language === "ar" ? "تم تفعيل الواجهة العربية" : "English interface enabled");
    render();
  }
  if (action === "profile-menu") { state.profileOpen = !state.profileOpen; render(); }
  if (action === "logout-confirm") openModal(t("auth.logoutConfirmTitle"), `<p>${t("auth.logoutConfirmMessage")}</p>`, `<button class="btn btn-danger" data-action="logout">${t("auth.logout")}</button><button class="btn btn-secondary" data-action="close-modal">${t("common.cancel")}</button>`);
  if (action === "logout") {
    const finishLogout = () => {
      authenticatedSession = false;
      closePortal();
      storage.set("renewpilot.account", null);
      toast(t("auth.logoutSuccess"));
      navigate("/login");
    };
    if (localPreview) finishLogout();
    else fetch("/api/auth/logout", { method: "POST" }).finally(finishLogout);
  }
  if (action === "device-link-method") {
    state.linkedDevice = { ...state.linkedDevice, linkMethod: target.dataset.method };
    persistLinkedDevice();
    render();
  }
  if (action === "create-pairing-code") {
    const phone = String(state.linkedDevice.phoneInput || "").trim();
    if (!phone) return toast("يرجى إدخال رقم واتساب.", "danger");
    if (!/^[1-9]\d{10,14}$/.test(phone)) return toast("اكتب الرقم بدون + أو مسافات، مثال: 9665XXXXXXXX.", "danger");
    try {
      if (localPreview) throw new Error("local-preview");
      const instance = await ensureEvolutionInstance();
      const payload = await fetchJson(`/api/whatsapp/instances/${instance.instanceId}/pairing-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: phone })
      });
      state.linkedDevice = { ...state.linkedDevice, status: "pending_pairing", linkMethod: "pairing", phoneNumber: `+${phone}`, pairingCode: payload.pairingCode, pairingExpiresAt: new Date(Date.now() + (payload.expiresIn || 60) * 1000).toLocaleTimeString("ar-SA"), activity: ["تم إنشاء رمز الاقتران عبر Evolution API", ...(state.linkedDevice.activity || []).slice(0, 4)] };
      persistLinkedDevice();
      toast("تم إنشاء رمز الاقتران");
      render();
    } catch (error) {
      if (!localPreview) return toast(error.message || "تعذر إنشاء رمز الاقتران", "danger");
      state.linkedDevice = { ...state.linkedDevice, status: "pending_pairing", linkMethod: "pairing", instanceId: `evo-${Date.now()}`, instanceName: "tenant-main-whatsapp", phoneNumber: `+${phone}`, pairingCode: `${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`, pairingExpiresAt: new Date(Date.now() + 60_000).toLocaleTimeString("ar-SA"), activity: ["تم إنشاء رمز الاقتران عبر Evolution API", ...(state.linkedDevice.activity || []).slice(0, 4)] };
      persistLinkedDevice();
      toast("تم إنشاء رمز الاقتران");
      render();
    }
  }
  if (action === "create-device-qr") {
    try {
      if (localPreview) throw new Error("local-preview");
      const instance = await ensureEvolutionInstance();
      const payload = instance.qrBase64 ? { qrBase64: instance.qrBase64, expiresIn: 60 } : await fetchJson(`/api/whatsapp/instances/${instance.instanceId}/qr`);
      state.linkedDevice = { ...state.linkedDevice, status: "pending_qr", linkMethod: "qr", qrActive: true, qrBase64: payload.qrBase64 || "", qrExpiresAt: new Date(Date.now() + (payload.expiresIn || 60) * 1000).toLocaleTimeString("ar-SA"), activity: ["تم إنشاء جلسة Evolution API", "تم تجهيز QR مؤقت", ...(state.linkedDevice.activity || []).slice(0, 3)] };
      persistLinkedDevice();
      toast("تم إنشاء باركود جديد عبر Evolution API");
      closePortal();
      render();
    } catch (error) {
      if (!localPreview) return toast(error.message || "تعذر إنشاء الباركود", "danger");
      state.linkedDevice = { ...state.linkedDevice, status: "pending_qr", linkMethod: "qr", instanceId: state.linkedDevice.instanceId || `evo-${Date.now()}`, instanceName: "tenant-main-whatsapp", qrActive: true, qrExpiresAt: new Date(Date.now() + 60_000).toLocaleTimeString("ar-SA"), activity: ["تم إنشاء جلسة Evolution API", ...(state.linkedDevice.activity || []).slice(0, 4)] };
      persistLinkedDevice();
      toast("تم إنشاء باركود جديد عبر Evolution API");
      closePortal();
      render();
    }
  }
  if (action === "show-device-qr") {
    const realQr = typeof state.linkedDevice.qrBase64 === "string" && state.linkedDevice.qrBase64.startsWith("data:image/png;base64,") ? `<img class="qr-real" src="${state.linkedDevice.qrBase64}" alt="باركود ربط واتساب">` : `<div class="qr-grid">${Array.from({ length: 49 }).map((_, index) => `<span class="${index % 4 === 0 ? "active" : ""}"></span>`).join("")}</div>`;
    openModal("باركود ربط واتساب", `<div class="qr-box active modal-qr">${realQr}<strong>${state.linkedDevice.qrActive ? "امسح الباركود من واتساب" : "أنشئ باركود جديد أولا"}</strong><p class="muted">تتم عملية الربط من الخادم ولا يتم كشف EVOLUTION_API_KEY.</p></div>`, `<button class="btn btn-primary" data-action="create-device-qr">إنشاء باركود جديد</button><button class="btn btn-secondary" data-action="close-modal">إغلاق</button>`);
  }
  if (action === "copy-pairing") copyText(state.linkedDevice.pairingCode || defaultLinkedDevice.pairingCode, "تم نسخ رمز الاقتران");
  if (action === "confirm-device-link") {
    if (!localPreview) return toast("يتم تأكيد الربط تلقائيًا بعد مسح QR", "warning");
    state.linkedDevice = {
      ...state.linkedDevice,
      status: "connected",
      qrActive: false,
      deviceName: "WhatsApp iPhone 15 Pro",
      phoneNumber: state.linkedDevice.phoneNumber || "+966 5X XXX XXXX",
      lastActivity: "منذ دقيقتين",
      lastCheckAt: "الآن",
      alerts: ["تم ربط واتساب بنجاح", "وضع الإرسال الآمن مفعل"],
      activity: ["تم الربط بنجاح", "تم فحص الاتصال", "آخر مزامنة منذ دقيقتين"]
    };
    persistLinkedDevice();
    toast("تم ربط حساب واتساب بنجاح");
    render();
  }
  if (action === "check-device-connection") {
    if (!["pending_qr", "pending_pairing", "connected"].includes(state.linkedDevice.status)) return toast("أنشئ جلسة ربط أولا", "warning");
    try {
      if (localPreview) throw new Error("local-preview");
      const payload = await fetchJson(`/api/whatsapp/instances/${state.linkedDevice.instanceId}/check`, { method: "POST" });
      state.linkedDevice = { ...state.linkedDevice, status: payload.status, phoneNumber: payload.phoneNumber || state.linkedDevice.phoneNumber, qrActive: payload.status !== "connected", qrBase64: payload.status === "connected" ? "" : state.linkedDevice.qrBase64, lastActivity: "الآن", lastCheckAt: "الآن", activity: [payload.status === "connected" ? "تم فحص الاتصال بنجاح" : "لا يزال الربط بانتظار واتساب", ...(state.linkedDevice.activity || []).slice(0, 4)] };
      persistLinkedDevice();
      toast(payload.status === "connected" ? "الاتصال يعمل بنجاح" : "لم يكتمل الربط بعد", payload.status === "connected" ? "success" : "warning");
      render();
    } catch (error) {
      if (!localPreview) return toast(error.message || "تعذر فحص الاتصال", "danger");
      if (state.linkedDevice.status === "pending_qr") return toast("الجلسة جاهزة، امسح الباركود من واتساب", "warning");
      if (state.linkedDevice.status === "pending_pairing") return toast("رمز الاقتران جاهز، أدخله في واتساب", "warning");
      state.linkedDevice.lastActivity = "الآن";
      state.linkedDevice.lastCheckAt = "الآن";
      persistLinkedDevice();
      toast("الاتصال يعمل بنجاح");
      render();
    }
  }
  if (action === "send-device-test") {
    if (state.linkedDevice.status !== "connected") return toast("لا يمكن الإرسال قبل ربط الجهاز", "danger");
    if (!localPreview) {
      return openModal("إرسال رسالة اختبار", `<form data-submit="send-device-test" class="grid"><label class="field"><span>رقم المستلم التجريبي</span><input class="input" name="to" inputmode="numeric" placeholder="9665XXXXXXXX" required></label><label class="field"><span>الرسالة</span><textarea class="textarea" name="message" required>مرحبًا {{name}}، هذه رسالة اختبار من RenewPilot AI. أرسل إيقاف لإلغاء الرسائل.</textarea></label><button class="btn btn-primary" type="submit">إرسال الاختبار</button></form>`);
    }
    state.linkedDevice.queuedMessages = (state.linkedDevice.queuedMessages || 0) + 1;
    state.linkedDevice.messagesToday = (state.linkedDevice.messagesToday || 0) + 1;
    state.linkedDevice.messagesMonth = (state.linkedDevice.messagesMonth || 0) + 1;
    state.linkedDevice.lastSendAt = "أضيفت إلى Queue الآن";
    persistLinkedDevice();
    toast("تمت إضافة رسالة الاختبار إلى Queue بنجاح");
    render();
  }
  if (action === "disconnect-device") {
    try {
      if (localPreview) throw new Error("local-preview");
      await fetchJson(`/api/whatsapp/instances/${state.linkedDevice.instanceId}/disconnect`, { method: "POST" });
      state.linkedDevice = { ...state.linkedDevice, status: "disconnected", qrActive: false, qrBase64: "", activity: ["تم فصل الجهاز", ...(state.linkedDevice.activity || []).slice(0, 4)] };
      persistLinkedDevice();
      toast("تم فصل الجهاز");
      render();
    } catch (error) {
      if (!localPreview) return toast(error.message || "تعذر فصل الجهاز", "danger");
      state.linkedDevice = { ...state.linkedDevice, status: "disconnected", qrActive: false };
      persistLinkedDevice();
      toast("تم فصل الجهاز");
      render();
    }
  }
  if (action === "delete-device") {
    try {
      if (localPreview) throw new Error("local-preview");
      await fetchJson(`/api/whatsapp/instances/${state.linkedDevice.instanceId}`, { method: "DELETE" });
      state.linkedDevice = { ...defaultLinkedDevice };
      persistLinkedDevice();
      toast("تم حذف الجهاز المرتبط");
      render();
    } catch (error) {
      if (!localPreview) return toast(error.message || "تعذر حذف الجهاز", "danger");
      state.linkedDevice = { ...defaultLinkedDevice };
      persistLinkedDevice();
      toast("تم حذف الجهاز المرتبط");
      render();
    }
  }
  if (action === "notifications") toast("لديك 3 تنبيهات تحتاج مراجعة");
  if (action === "open-demo") openModal("احجز عرضًا توضيحيًا", demoForm());
  if (action === "billing") { state.billing = target.dataset.billing; storage.set("renewpilot.billing", state.billing); render(); }
  if (action === "select-plan") navigate(`/login?plan=${target.dataset.plan}`);
  if (action === "forgot-password") navigate("/forgot-password");
  if (action === "google-login") toast("سيتم ربط تسجيل الدخول عبر Google لاحقًا", "warning");
  if (action === "open-ticket") openModal("فتح تذكرة دعم", `<form data-submit="ticket" class="grid">${field("الموضوع", "subject")}${field("البريد", "email", "email")}<textarea class="textarea" name="body" required placeholder="وصف المشكلة"></textarea><button class="btn btn-primary">إرسال التذكرة</button></form>`);
  if (action === "open-chat") openDrawer("الدردشة المباشرة", `<div class="activity-list"><div class="activity-item">${icon("د")}<div><strong>فريق الدعم</strong><p class="muted">مرحبًا، كيف يمكننا مساعدتك؟</p></div></div></div><form data-submit="chat"><input class="input" name="message" required placeholder="اكتب رسالتك"><br><br><button class="btn btn-primary">إرسال</button></form>`);
  if (action === "open-email") location.href = "mailto:support@renewpilot.ai?subject=طلب دعم RenewPilot AI";
  if (action === "open-whatsapp") window.open("https://wa.me/966500000000?text=مرحبًا، أحتاج دعم RenewPilot AI", "_blank");
  if (action === "knowledge") toast(`تم فتح قسم ${target.dataset.term}`);
  if (action === "support-chip") { state.search = target.dataset.term; render(); }
  if (action === "add-subscription") openModal("إضافة اشتراك جديد", subscriptionForm());
  if (action === "bulk-import") openModal(state.language === "ar" ? "استيراد اشتراكات من Excel" : "Import subscriptions from Excel", `<form data-submit="import-preview" class="grid"><label class="field"><span>${state.language === "ar" ? "الصق الجدول هنا" : "Paste the spreadsheet here"}</span><textarea class="textarea spreadsheet-input" name="text" required placeholder="رقم الطلب\tاسم العميل\tرقم الجوال\tالخدمة\tتاريخ البداية\tتاريخ الانتهاء\tرابط التجديد"></textarea></label><button class="btn btn-primary">${state.language === "ar" ? "معاينة قبل الحفظ" : "Preview before saving"}</button></form><div id="import-preview"></div>`);
  if (action === "mark-renewed") openModal(state.language === "ar" ? "تم التجديد" : "Mark as renewed", `<form data-submit="quick-renew" data-key="${target.dataset.key}" class="grid"><label class="field"><span>${state.language === "ar" ? "مدة التجديد" : "Renewal duration"}</span><select class="select" name="duration"><option value="month">${state.language === "ar" ? "شهر" : "One month"}</option><option value="three_months">${state.language === "ar" ? "3 أشهر" : "3 months"}</option><option value="six_months">${state.language === "ar" ? "6 أشهر" : "6 months"}</option><option value="year">${state.language === "ar" ? "سنة" : "One year"}</option><option value="custom">${state.language === "ar" ? "تاريخ مخصص" : "Custom date"}</option></select></label><label class="field"><span>${state.language === "ar" ? "التاريخ المخصص" : "Custom date"}</span><input class="input" type="date" name="customDate"></label><button class="btn btn-primary">${t("common.confirm")}</button><button type="button" class="btn btn-secondary" data-action="close-modal">${t("common.cancel")}</button></form>`);
  if (action === "add-unsubscribe") openModal(t("sidebar.unsubscribe"), `<form data-submit="unsubscribe" class="grid">${field(state.language === "ar" ? "رقم واتساب" : "WhatsApp number", "phoneNumber", "tel")}${field(state.language === "ar" ? "السبب" : "Reason", "reason")}<button class="btn btn-primary">${t("common.save")}</button></form>`);
  if (action === "import-save") {
    const text = state.importText || "";
    try {
      const response = await fetch("/api/subscriptions/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      if (!response.ok && location.hostname !== "127.0.0.1" && location.hostname !== "localhost") throw new Error("Import failed");
    } catch {
      if (location.hostname !== "127.0.0.1" && location.hostname !== "localhost") return toast(t("common.serverError"), "danger");
    }
    const lines = text.trim().split(/\r?\n/).slice(1);
    lines.forEach((line) => {
      const [order, customer, phone, service, start, end, renewal] = line.split("\t");
      if (order && customer && /^\d{4}-\d{2}-\d{2}$/.test(end || "")) state.subscriptions.unshift({ order, customer, phone, service, plan: service, start, end, renewal, status: end < new Date().toISOString().slice(0, 10) ? "متأخر" : "نشط" });
    });
    storage.set("renewpilot.subscriptions", state.subscriptions);
    closePortal();
    toast(state.language === "ar" ? "تم حفظ الصفوف الصحيحة وعرض الأخطاء." : "Valid rows were saved and errors were reported.");
    render();
  }
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
  if (action === "edit-template") openModal("تعديل القالب", `<form data-submit="template" class="grid"><textarea class="textarea" name="template" required>مرحبًا {{name}}، اشتراكك ينتهي قريبًا. جدد الآن من الرابط الآمن. أرسل إيقاف لإلغاء الرسائل.</textarea><div id="message-quality"></div><button class="btn btn-secondary" type="button" data-action="check-message-quality">${state.language === "ar" ? "فحص جودة الرسالة" : "Check message quality"}</button><button class="btn btn-primary">${state.language === "ar" ? "حفظ القالب" : "Save template"}</button></form>`);
  if (action === "check-message-quality") {
    const textarea = portal.querySelector("textarea[name='template']");
    const message = textarea?.value || "";
    const links = (message.match(/https?:\/\//g) || []).length;
    const problems = [links > 2 && (state.language === "ar" ? "روابط كثيرة" : "Too many links"), !/{{name}}|{{customer_name}}/.test(message) && (state.language === "ar" ? "اسم العميل غير موجود" : "Customer name is missing"), !/stop|unsubscribe|إيقاف|توقف|لا ترسل/i.test(message) && (state.language === "ar" ? "خيار الإيقاف غير موجود" : "Opt-out text is missing")].filter(Boolean);
    const risk = problems.length * 25;
    const quality = portal.querySelector("#message-quality");
    if (quality) quality.innerHTML = `<div class="quality-result ${risk >= 50 ? "danger" : risk ? "warning" : "success"}"><strong>${risk >= 50 ? (state.language === "ar" ? "خطر" : "Risk") : risk ? (state.language === "ar" ? "يحتاج تحسين" : "Needs improvement") : (state.language === "ar" ? "ممتاز" : "Excellent")}</strong><span>${risk}/100</span><p>${problems.join(" · ") || (state.language === "ar" ? "الرسالة جاهزة للإرسال الآمن." : "The message is ready for safe sending.")}</p></div>`;
  }
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

async function handleSubmit(form, event) {
  event.preventDefault();
  const type = form.dataset.submit;
  const data = Object.fromEntries(new FormData(form));
  if (type === "send-device-test") {
    const button = form.querySelector("button[type='submit']");
    if (button) { button.disabled = true; button.textContent = t("common.loading"); }
    try {
      await fetchJson(`/api/whatsapp/instances/${state.linkedDevice.instanceId}/send-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      state.linkedDevice.messagesToday = (state.linkedDevice.messagesToday || 0) + 1;
      state.linkedDevice.messagesMonth = (state.linkedDevice.messagesMonth || 0) + 1;
      state.linkedDevice.lastSendAt = "الآن";
      state.linkedDevice.activity = ["تم إرسال رسالة اختبار بنجاح", ...(state.linkedDevice.activity || []).slice(0, 4)];
      persistLinkedDevice();
      closePortal();
      toast("تم إرسال رسالة الاختبار بنجاح");
      render();
    } catch (error) {
      if (button) { button.disabled = false; button.textContent = "إرسال الاختبار"; }
      toast(error.message || "تعذر إرسال رسالة الاختبار", "danger");
    }
    return;
  }
  if (type === "login") {
    if (!data.email) return toast(t("auth.emailRequired"), "danger");
    if (!data.password) return toast(t("auth.passwordRequired"), "danger");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return toast(t("auth.invalidEmail"), "danger");
    const button = form.querySelector("button[type='submit'], button:not([type])");
    if (button) { button.disabled = true; button.textContent = t("common.loading"); }
    let authenticated = false;
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      authenticated = response.ok && await browserSessionIsValid();
    } catch {
      authenticated = false;
    }
    if (!authenticated) { if (button) { button.disabled = false; button.textContent = t("auth.login"); } return toast(t("auth.invalidCredentials"), "danger"); }
    authenticatedSession = true;
    toast(t("auth.loginSuccess"));
    await navigate("/dashboard");
    return;
  }
  if (type === "register") {
    if (!data.name || data.name.trim().length < 3) return toast(state.language === "ar" ? "يرجى إدخال الاسم الكامل." : "Please enter your full name.", "danger");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || "")) return toast(t("auth.invalidEmail"), "danger");
    if (!/^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(data.password || "")) return toast(t("auth.passwordMin"), "danger");
    if (data.password !== data.confirmPassword) return toast(t("auth.passwordMismatch"), "danger");
    try {
      const response = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!response.ok || !await browserSessionIsValid()) return toast(t("common.serverError"), "danger");
    } catch {
      return toast(t("common.serverError"), "danger");
    }
    authenticatedSession = true;
    storage.set("renewpilot.account", { name: data.name, email: data.email, createdAt: new Date().toISOString() });
    toast(t("auth.registerSuccess"));
    await navigate("/dashboard");
    return;
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
  if (type === "forgot") {
    if (!data.email) return toast(t("auth.emailRequired"), "danger");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return toast(t("auth.invalidEmail"), "danger");
    const button = form.querySelector("button");
    if (button) { button.disabled = true; button.textContent = t("common.loading"); }
    try {
      const response = await fetch("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: data.email, locale: state.language }) });
      const body = await response.json();
      if (!response.ok) { if (button) button.disabled = false; return toast(body.message || t("common.serverError"), "danger"); }
      state.resetEmail = data.email;
      state.resetStep = 2;
      toast(body.message || t("auth.codeSent"));
      render();
    } catch {
      if (button) button.disabled = false;
      toast(t("common.serverError"), "danger");
    }
  }
  if (type === "reset-password") {
    if (data.password !== data.confirmPassword) return toast(t("auth.passwordMismatch"), "danger");
    if (!/^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(data.password || "")) return toast(t("auth.passwordMin"), "danger");
    try {
      const response = await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: state.resetEmail, code: data.code, password: data.password }) });
      if (!response.ok) return toast(state.language === "ar" ? "الكود غير صحيح أو منتهي." : "The code is invalid or expired.", "danger");
      state.resetStep = 3;
      toast(t("auth.passwordChanged"));
      render();
    } catch { toast(t("common.serverError"), "danger"); }
  }
  if (type === "import-preview") {
    state.importText = data.text;
    const lines = String(data.text || "").trim().split(/\r?\n/);
    const rows = lines.slice(1);
    const duplicatePhones = new Set();
    const seen = new Set();
    let invalid = 0;
    rows.forEach((line) => { const cells = line.split("\t"); const phone = (cells[2] || "").replace(/\D/g, ""); if (seen.has(phone)) duplicatePhones.add(phone); seen.add(phone); if (cells.length < 7 || !/^\d{4}-\d{2}-\d{2}$/.test(cells[5] || "")) invalid++; });
    const preview = portal.querySelector("#import-preview");
    if (preview) preview.innerHTML = `<div class="import-summary"><span class="status success">${rows.length - invalid} ${state.language === "ar" ? "صف صحيح" : "valid rows"}</span><span class="status danger">${invalid} ${state.language === "ar" ? "صفوف فيها أخطاء" : "invalid rows"}</span><span class="status warning">${duplicatePhones.size} ${state.language === "ar" ? "أرقام مكررة" : "duplicate numbers"}</span></div><button class="btn btn-primary" data-action="import-save">${state.language === "ar" ? "حفظ الصفوف الصحيحة" : "Save valid rows"}</button>`;
  }
  if (type === "quick-renew") {
    const row = state.subscriptions.find((item) => item.order === form.dataset.key);
    if (!row) return toast(t("common.serverError"), "danger");
    const months = { month: 1, three_months: 3, six_months: 6, year: 12 }[data.duration];
    if (data.duration === "custom") row.end = data.customDate;
    else { const end = new Date(`${row.end}T12:00:00Z`); end.setUTCMonth(end.getUTCMonth() + months); row.end = end.toISOString().slice(0, 10); }
    row.status = "تم التجديد";
    storage.set("renewpilot.subscriptions", state.subscriptions);
    closePortal();
    toast(state.language === "ar" ? "تم تمديد الاشتراك وتسجيل العملية." : "Subscription renewed and activity recorded.");
    render();
  }
  if (type === "unsubscribe") {
    try { await fetch("/api/unsubscribes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); } catch {}
    closePortal();
    toast(state.language === "ar" ? "تمت إضافة الرقم إلى قائمة الإيقاف." : "The number was added to the unsubscribe list.");
  }
  if (type === "password") {
    const password = data.new || "";
    if (!/^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password)) return toast("كلمة المرور يجب أن تكون 8 أحرف على الأقل وتحتوي على حرف ورقم ورمز خاص.", "danger");
    closePortal();
    toast("تم تغيير كلمة المرور بنجاح، يمكنك تسجيل الدخول الآن.");
  }
  if (["demo", "ticket", "chat", "message", "template", "ai-question"].includes(type)) {
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
      "/dashboard/connected-devices": connectedDevicesCenterPage,
      "/dashboard/linked-devices": connectedDevicesCenterPage,
      "/dashboard/whatsapp-safety": whatsappSafetyPage,
      "/dashboard/unsubscribe": unsubscribePage,
      "/dashboard/activity": activityPage,
      "/dashboard/billing": billingPage,
      "/dashboard/settings": settingsPage
    };
    app.innerHTML = (pages[state.route] || dashboardHome)();
    localizeElement(app);
    return;
  }
  const pages = {
    "/": homePage,
    "/features": featuresPage,
    "/pricing": pricingPage,
    "/support": supportPage,
    "/login": loginPage,
    "/register": loginPage,
    "/forgot-password": forgotPasswordPage,
    "/reset-password": forgotPasswordPage
  };
  app.innerHTML = (pages[state.route] || homePage)();
  localizeElement(app);
}

document.addEventListener("click", (event) => {
  const link = event.target.closest("[data-link]");
  if (link) {
    event.preventDefault();
    navigate(link.dataset.link);
    return;
  }
  const action = event.target.closest("[data-action]");
  if (action) {
    if ((action.classList.contains("modal-overlay") || action.classList.contains("drawer-overlay")) && event.target !== action) return;
    handleAction(action);
  }
});

document.addEventListener("submit", (event) => {
  const form = event.target.closest("[data-submit]");
  if (form) handleSubmit(form, event);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && portal.innerHTML) closePortal();
});

document.addEventListener("input", (event) => {
  const target = event.target;
  if (target.dataset.action === "dashboard-search" || target.dataset.action === "global-search" || target.dataset.action === "support-search") {
    state.search = target.value;
    if (target.dataset.action !== "global-search") render();
  }
  if (target.dataset.action === "pairing-phone-input") {
    state.linkedDevice.phoneInput = target.value;
    persistLinkedDevice();
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
if (["/dashboard/connected-devices", "/dashboard/linked-devices"].includes(state.route)) void syncLinkedDevice();
