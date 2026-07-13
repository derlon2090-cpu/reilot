import { features, pricingPlans, knowledgeBase } from "../data/publicData.js";

const app = document.querySelector("#app");
const portal = document.querySelector("#portal");

const localeMessages = Object.fromEntries(await Promise.all(["ar", "en"].map(async (locale) => {
  const response = await fetch(`/app/locales/${locale}.json`);
  if (!response.ok) throw new Error(`Unable to load ${locale} locale`);
  return [locale, await response.json()];
})));

const operationalEnglishPhrases = {
  "فحص الجاهزية": "Readiness Check",
  "تشغيل اختبار شامل": "Run Comprehensive Test",
  "إعادة الفحص": "Run Again",
  "جاري فحص حالة المنصة...": "Checking platform status...",
  "قاعدة البيانات": "Database",
  "اتصال واتساب": "WhatsApp Connection",
  "متغيرات البيئة": "Environment Variables",
  "جاهز": "Ready",
  "غير جاهز": "Not Ready",
  "آخر فحص:": "Last check:",
  "الناقص:": "Missing:",
  "آخر نسخة احتياطية": "Last Backup",
  "لا توجد نسخة احتياطية مسجلة": "No backup has been recorded",
  "سجل المشاكل": "Issue Log",
  "تحديث السجل": "Refresh Log",
  "جاري تحميل سجل المشاكل...": "Loading issue log...",
  "لا توجد مشاكل تشغيلية مسجلة": "No operational issues recorded",
  "تم الحل": "Resolved",
  "مفتوحة": "Open",
  "المصدر:": "Source:",
  "الحل المقترح:": "Suggested solution:",
  "تم التجديد": "Renewed",
  "إرسال تذكير": "Send Reminder",
  "نسخ رابط التجديد": "Copy Renewal Link",
  "سجل التنبيهات": "Notification History",
  "تعديل الرقم": "Edit Number",
  "إيقاف التذكيرات": "Pause Reminders",
  "استئناف التذكيرات": "Resume Reminders",
  "حالة واتساب": "WhatsApp Status",
  "الإجراءات": "Actions",
  "يجب ربط واتساب أولًا": "Connect WhatsApp first",
  "الإرسال متوقف بسبب ارتفاع المخاطر": "Sending stopped due to high risk",
  "التذكيرات موقوفة لهذا العميل": "Reminders are paused for this customer",
  "جاري تحميل الاشتراكات من قاعدة البيانات...": "Loading subscriptions from the database...",
  "لا توجد اشتراكات في قاعدة البيانات": "No subscriptions in the database",
  "تعذر تحميل الاشتراكات": "Unable to load subscriptions",
  "إعادة المحاولة": "Try Again",
  "ممتاز": "Excellent",
  "جيد": "Good",
  "متوسط": "Medium",
  "خطر": "Danger",
  "تم إيقاف الإرسال التلقائي لأن درجة المخاطر أعلى من 70.": "Automatic sending is paused because the risk score is above 70.",
  "مراجعة المخاطر": "Review Risks",
  "حالة القناة": "Channel Status",
  "لا يوجد رقم": "No phone number",
  "ساعة": "hour",
  "يوم": "day",
  "جاري تحميل بيانات الحماية...": "Loading safety data...",
  "لا توجد قناة واتساب مرتبطة": "No WhatsApp channel is connected",
  "تعديل رقم واتساب": "Edit WhatsApp Number",
  "رقم واتساب بصيغة دولية": "WhatsApp number in international format",
  "حفظ الرقم": "Save Number",
  "مدة التجديد": "Renewal Duration",
  "شهر": "One month",
  "3 أشهر": "3 months",
  "6 أشهر": "6 months",
  "سنة": "One year",
  "تاريخ مخصص": "Custom Date",
  "التاريخ المخصص": "Custom Date",
  "إرسال إشعار بعد التجديد (اختياري)": "Send a notification after renewal (optional)",
  "لا توجد تنبيهات لهذا الاشتراك": "No notifications for this subscription",
  "تم تمديد الاشتراك وتسجيل العملية دون إرسال تلقائي.": "The subscription was extended and logged without automatic sending.",
  "تمت إضافة التذكير إلى قائمة الإرسال": "The reminder was added to the send queue",
  "تم تحديث رقم واتساب": "WhatsApp number updated",
  "تم تحديث حالة التذكيرات": "Reminder status updated",
  "الأجهزة المرتبطة": "Linked Devices",
  "ربط واتساب": "Connect WhatsApp",
  "إعادة إنشاء الباركود": "Regenerate QR Code",
  "لا يوجد باركود حقيقي متاح": "No real QR code is available",
  "لا يوجد باركود صالح": "No valid QR code is available",
  "أنشئ باركود حقيقي من Evolution API.": "Generate a real QR code from Evolution API.",
  "غير متوفر": "Unavailable",
  "لا يظهر الرمز إلا بعد طلبه من Evolution API": "The code appears only after it is returned by Evolution API",
  "لا يوجد رمز بعد": "No code yet",
  "رمز الاقتران غير مدعوم حاليا في نسخة Evolution API المثبتة. استخدم الربط بالباركود.": "Pairing codes are not supported by the installed Evolution API version. Use QR linking.",
  "تم إيقاف الإرسال التلقائي": "Automatic sending paused"
};

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
  const translated = operationalEnglishPhrases[trimmed] || operationalEnglishPhrases[core] || localeMessages.en.phrases?.[trimmed] || localeMessages.en.phrases?.[core];
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
  pairingCode: "",
  pairingSupported: true,
  qrLoading: false,
  qrImageLoaded: false,
  pairingLoading: false,
  qrError: "",
  pairingError: "",
  qrActive: false,
  qrExpiresAt: "",
  pairingExpiresAt: "",
  lastActivity: "",
  lastCheckAt: "",
  lastSendAt: "",
  messagesToday: 0,
  messagesMonth: 0,
  safetyScore: 0,
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
  reportPeriod: "6",
  filter: "الكل",
  search: "",
  settings: { whatsapp: false, email: false, sms: false, twoFactor: false, renewAuto: false },
  linkedDevice: { ...defaultLinkedDevice }
};

state.dbSubscriptions = null;
state.dbCustomers = null;
state.dashboardOverview = null;
state.activities = null;
state.unsubscribes = null;
state.accountSettings = null;
state.readiness = null;
state.operationalIssues = null;
state.whatsappHealth = null;
state.remoteLoading = {};

const routes = [
  ["/", "sidebar.home"],
  ["/features", "public.features"],
  ["/pricing", "public.pricing"],
  ["/support", "public.support"]
];

const dashboardRoutes = [
  ["/dashboard", "الرئيسية", "home"],
  ["/dashboard/subscriptions", "الاشتراكات", "subscriptions"],
  ["/dashboard/customers", "العملاء", "customers"],
  ["/dashboard/devices", "الأجهزة", "devices"],
  ["/dashboard/security", "الحماية", "security"],
  ["/dashboard/reports", "التقارير", "reports"],
  ["/dashboard/settings", "الإعدادات", "settings"]
];

const dashboardAliases = {
  "/dashboard/renewals": "/dashboard/subscriptions",
  "/dashboard/notifications": "/dashboard/customers",
  "/dashboard/connected-devices": "/dashboard/devices",
  "/dashboard/linked-devices": "/dashboard/devices",
  "/dashboard/whatsapp-safety": "/dashboard/security",
  "/dashboard/unsubscribe": "/dashboard/security",
  "/dashboard/warranty": "/dashboard/security",
  "/dashboard/activity": "/dashboard/reports",
  "/dashboard/billing": "/dashboard/reports",
  "/dashboard/readiness": "/dashboard/security",
  "/dashboard/issues": "/dashboard/security"
};

function applyPreferences() {
  document.documentElement.dataset.theme = state.theme;
  document.documentElement.lang = state.language;
  document.documentElement.dir = state.language === "ar" ? "rtl" : "ltr";
}

async function fetchJson(url, options = {}) {
  const { timeoutMessage, ...fetchOptions } = options;
  let response;
  try {
    response = await fetch(url, { credentials: "include", ...fetchOptions });
  } catch (error) {
    if (["AbortError", "TimeoutError"].includes(error?.name)) {
      const timeoutError = new Error(timeoutMessage || "استغرق الطلب وقتًا أطول من المتوقع. حاول مرة أخرى.");
      timeoutError.code = "EVOLUTION_TIMEOUT";
      throw timeoutError;
    }
    throw error;
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || payload.error || "Request failed");
    error.status = response.status;
    error.code = payload.code;
    throw error;
  }
  return payload;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function isRealQrDataUri(value) {
  return typeof value === "string" && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]{1000,}$/.test(value);
}

async function loadRemotePage(key, url, target, options) {
  if (state.remoteLoading[key]) return;
  state.remoteLoading[key] = true;
  try {
    const payload = await fetchJson(url, options);
    state[target] = payload.items ?? payload.report ?? payload;
    if (target === "accountSettings" && payload.settings) {
      state.settings = {
        whatsapp: Boolean(payload.settings.notificationChannels?.whatsapp),
        email: Boolean(payload.settings.notificationChannels?.email),
        sms: Boolean(payload.settings.notificationChannels?.sms),
        twoFactor: Boolean(payload.settings.security?.twoFactor),
        renewAuto: Boolean(payload.settings.security?.renewAuto)
      };
    }
  } catch (error) {
    state[target] = { error: error.message || "تعذر تحميل البيانات" };
  } finally {
    state.remoteLoading[key] = false;
    render();
  }
}

function syncRouteData(force = false) {
  if (state.route.startsWith("/dashboard") && (force || state.dashboardOverview === null)) void loadRemotePage("overview", "/api/dashboard/overview", "dashboardOverview");
  if (["/dashboard", "/dashboard/subscriptions"].includes(state.route) && (force || state.dbSubscriptions === null)) void loadRemotePage("subscriptions", "/api/subscriptions", "dbSubscriptions");
  if (["/dashboard", "/dashboard/subscriptions", "/dashboard/customers"].includes(state.route) && (force || state.dbCustomers === null)) void loadRemotePage("customers", "/api/customers", "dbCustomers");
  if (state.route === "/dashboard/security" && (force || state.unsubscribes === null)) void loadRemotePage("unsubscribes", "/api/unsubscribes", "unsubscribes");
  if (["/dashboard/security", "/dashboard/devices"].includes(state.route) && (force || state.whatsappHealth === null)) void loadRemotePage("whatsappHealth", "/api/whatsapp/health", "whatsappHealth");
  if (state.route === "/dashboard/settings" && (force || state.accountSettings === null)) void loadRemotePage("settings", "/api/settings", "accountSettings");
}

async function ensureEvolutionInstance(options = {}) {
  if (state.linkedDevice.instanceId) return state.linkedDevice;
  const payload = await fetchJson("/api/whatsapp/instances/create", { method: "POST", ...options });
  state.linkedDevice = {
    ...state.linkedDevice,
    ...payload.instance,
    instanceId: payload.instance?.id,
    instanceName: payload.instance?.instanceName || "",
    qrBase64: payload.instance?.qrBase64 || ""
  };
  return state.linkedDevice;
}

async function syncLinkedDevice() {
  if (state.deviceSyncing) return;
  state.deviceSyncing = true;
  try {
    const response = await fetch("/api/whatsapp/instances/create");
    if (!response.ok) return;
    const payload = await response.json();
    if (payload.instance) {
      state.linkedDevice = { ...state.linkedDevice, ...payload.instance, instanceId: payload.instance.id };
      render();
    }
  } finally {
    state.deviceSyncing = false;
  }
}

async function browserSessionIsValid() {
  try {
    const response = await fetch("/api/auth/session", { cache: "no-store", credentials: "include" });
    const payload = await response.json().catch(() => null);
    return response.ok && payload?.ok === true && Boolean(payload.user?.id);
  } catch {
    return false;
  }
}

async function navigate(to) {
  const url = new URL(to, location.origin);
  url.pathname = dashboardAliases[url.pathname] || url.pathname;
  if (url.pathname.startsWith("/dashboard")) {
    if (!await browserSessionIsValid()) {
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
  if (state.route === "/dashboard/devices") void syncLinkedDevice();
}

async function enterDashboardAfterSessionVerification() {
  if (!await browserSessionIsValid()) return false;
  history.pushState({}, "", "/dashboard");
  state.route = "/dashboard";
  state.query = new URLSearchParams();
  state.navOpen = false;
  state.sidebarOpen = false;
  state.profileOpen = false;
  state.search = "";
  render();
  return true;
}

function toneClass(value = "") {
  const normalized = String(value).toLowerCase();
  if (["نشط", "تم التجديد", "تم التسليم", "محلولة", "منخفض", "active", "renewed", "connected", "sent", "delivered", "read"].some((x) => normalized.includes(x))) return "success";
  if (["قريب", "انتظار", "مراجعة", "متوسطة", "pending", "expiring", "connecting"].some((x) => normalized.includes(x))) return "warning";
  if (["متأخر", "فشلت", "عالية", "مرتفع", "expired", "failed", "error", "risk"].some((x) => normalized.includes(x))) return "danger";
  if (["موقوف", "paused", "inactive", "disconnected", "cancelled"].some((x) => normalized.includes(x))) return "neutral";
  return "info";
}

function status(value) {
  const labels = state.language === "ar" ? {
    active: "نشط", inactive: "غير نشط", expiring_soon: "ينتهي قريبًا", expired: "منتهي",
    renewed: "تم التجديد", paused: "موقوف", cancelled: "ملغي", connected: "متصل",
    disconnected: "غير متصل", not_connected: "غير متصل", pending_qr: "بانتظار الباركود",
    pending_pairing: "بانتظار الاقتران", connecting: "جارٍ الاتصال", sent: "تم الإرسال",
    delivered: "تم التسليم", read: "تمت القراءة", failed: "فشل"
  } : {};
  const label = labels[value] || value || (state.language === "ar" ? "غير محدد" : "Unknown");
  return `<span class="status ${toneClass(value)}">${escapeHtml(label)}</span>`;
}

function icon(text, tone = "") {
  return `<span class="icon-bubble ${tone}">${text}</span>`;
}

function logo() {
  const destination = state.route.startsWith("/dashboard") ? "/dashboard" : "/";
  return `<button class="brand btn-ghost" data-link="${destination}" aria-label="RenewPilot AI">
    <span class="brand-mark" aria-hidden="true"><span>R</span></span><span class="brand-wordmark">RenewPilot <b>AI</b></span>
  </button>`;
}

function dashboardIcon(name) {
  const paths = {
    home: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    subscriptions: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M8 15h4"/>',
    customers: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    devices: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
    security: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    reports: '<path d="M3 3v18h18"/><path d="m7 16 4-5 4 3 5-7"/>',
    notifications: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.55V21h-4v-.08a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3v-4h.08a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3h4v.08a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.12.61.65 1.05 1.27 1.05H21v4h-.08c-.63 0-1.16.44-1.52 1z"/>'
  };
  return `<svg class="line-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.home}</svg>`;
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
  return `<div class="grid grid-5 dashboard-stat-grid">${items.map((item) => `<article class="card stat-card ${item.tone || "info"}">
    <div><span class="muted">${item.title}</span><strong>${item.value}</strong><small>${item.caption || item.change || ""}</small></div>
    <span class="stat-card-icon">${dashboardIcon(item.icon || "reports")}</span>
  </article>`).join("")}</div>`;
}

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString(state.language === "ar" ? "ar-SA" : "en-US", { maximumFractionDigits: 2 })} ${state.language === "ar" ? "ر.س" : "SAR"}`;
}

function overviewStats() {
  return state.dashboardOverview?.stats || {
    totalSubscriptions: 0, upcomingRenewals: 0, expiredSubscriptions: 0,
    totalCustomers: 0, activeCustomers: 0, activeToday: 0,
    connectedDevices: 0, pendingDevices: 0, monthlyRevenue: 0,
    totalMessages: 0, sentMessages: 0, deliveryRate: 0, successRate: 0,
    blockedNumbers: 0, safeRules: 0, renewedCustomers: 0
  };
}

function performanceChart(rows = []) {
  const values = rows.map((row) => Number(row.value || 0));
  const max = Math.max(...values, 0);
  if (!max) return emptyState("لا توجد بيانات أداء بعد", "ستظهر حركة الإيراد هنا بعد إضافة الاشتراكات.");
  return `<div class="performance-chart" aria-label="الأداء خلال ستة أشهر">${rows.map((row) => `<div class="performance-column"><span style="height:${Math.max(8, Math.round((Number(row.value || 0) / max) * 100))}%"></span><small>${escapeHtml(row.month)}</small></div>`).join("")}</div>`;
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
          ${Array.from({ length: 4 }, () => `<div class="preview-stat art-skeleton"><span></span><strong></strong></div>`).join("")}
        </div>
        <div class="table-skeleton">
          ${Array.from({ length: 6 }).map((_, index) => `<div class="sk-row">
            <span class="fake-line ${index === 0 ? "active" : ""}"></span><span class="fake-line"></span><span class="fake-line"></span><span class="fake-line"></span>
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
          <div class="art-stats">${Array.from({ length: 4 }, () => `<span class="art-skeleton"><small></small><strong></strong></span>`).join("")}</div>
          <div class="art-table">${Array.from({ length: 4 }, () => `<div class="art-skeleton-row"><span></span><b></b></div>`).join("")}</div>
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
  const links = dashboardRoutes.map(([path, label, mark]) => `<button class="side-link ${state.route === path ? "active" : ""}" data-link="${path}">${dashboardIcon(mark)}<span>${state.language === "ar" ? label : ({ "الرئيسية": "Dashboard", "الاشتراكات": "Subscriptions", "العملاء": "Customers", "الأجهزة": "Devices", "الحماية": "Security", "التقارير": "Reports", "الإعدادات": "Settings" }[label])}</span></button>`).join("");
  const themeIcon = state.theme === "dark" ? "☾" : "☀";
  const profile = state.dashboardOverview?.profile || {};
  const profileName = profile.name || (state.language === "ar" ? "المستخدم" : "User");
  const profileInitial = profileName.trim().slice(0, 1) || "R";
  const planName = profile.planName || (state.language === "ar" ? "تجربة مجانية" : "Free Trial");
  return `<div class="dashboard-shell">
    <aside class="sidebar ${state.sidebarOpen ? "open" : ""}">
      <div class="sidebar-brand">${logo()}</div>
      <nav class="side-links">${links}</nav>
      <div class="sidebar-foot"><span class="sidebar-foot-icon">AI</span><div><strong>RenewPilot AI</strong><small>${state.language === "ar" ? "إدارة التجديدات بوضوح" : "Renewals, clearly managed"}</small></div></div>
    </aside>
    <main class="dashboard-main">
      <header class="topbar">
        <div class="topbar-tools">
          <button class="btn btn-secondary icon-btn mobile-side-toggle" data-action="toggle-sidebar">☰</button>
          <div class="search-wrap dashboard-search"><span class="search-icon">⌕</span><input class="input" data-action="global-search" placeholder="${state.language === "ar" ? "بحث سريع..." : "Quick search..."}" value="${state.search}"></div>
        </div>
        <div class="topbar-tools">
          <span class="plan-badge">${escapeHtml(planName)}</span>
          <button class="btn btn-ghost icon-btn" data-action="theme" title="${state.language === "ar" ? "تغيير المظهر" : "Change theme"}">${themeIcon}</button>
          <button class="btn btn-ghost icon-btn" data-action="notifications" title="${state.language === "ar" ? "التنبيهات" : "Notifications"}">${dashboardIcon("notifications")}</button>
          <button class="btn btn-secondary" data-action="language">${state.language === "ar" ? "EN" : "AR"}</button>
          <button class="profile-trigger" data-action="profile-menu"><span class="avatar">${escapeHtml(profileInitial)}</span><span><strong>${escapeHtml(profileName)}</strong><small>${escapeHtml(profile.email || "")}</small></span></button>
          ${state.profileOpen ? `<div class="profile-menu"><button data-link="/dashboard/settings">${t("dashboard.profile")}</button><button data-link="/dashboard/settings">${t("dashboard.settings")}</button><button class="danger-text" data-action="logout-confirm">${t("auth.logout")}</button></div>` : ""}
        </div>
      </header>
      <div class="content">${content}</div>
    </main>
  </div>`;
}

function dashboardHome() {
  const stats = overviewStats();
  const latest = Array.isArray(state.dbSubscriptions) ? state.dbSubscriptions.slice(0, 5) : [];
  const latestContent = state.dbSubscriptions?.error
    ? emptyState("تعذر تحميل الاشتراكات", escapeHtml(state.dbSubscriptions.error))
    : state.dbSubscriptions === null
      ? `<div class="loading-state">جاري تحميل الاشتراكات من قاعدة البيانات...</div>`
      : latest.length ? subscriptionsTable(latest, true) : emptyState("لا توجد اشتراكات بعد", "ابدأ بإضافة أول اشتراك لإدارة التجديدات والتنبيهات.", "إضافة اشتراك", "add-subscription");
  const activities = (state.dashboardOverview?.activities || []).filter((item) => !String(item.type || "").startsWith("auth."));
  const hasBusinessData = stats.totalSubscriptions > 0 || stats.totalCustomers > 0 || stats.connectedDevices > 0;
  const alertDisabled = stats.connectedDevices > 0 ? "" : "disabled";
  return dashboardShell(`${pageTitle("الرئيسية", `<button class="btn btn-primary" data-action="add-subscription">إضافة اشتراك</button>`)}
    ${!hasBusinessData ? `<section class="welcome-panel"><div><span class="welcome-kicker">RenewPilot AI</span><h2>مرحبًا بك في RenewPilot AI</h2><p>ابدأ بإضافة أول عميل أو ربط جهازك. لن تظهر هنا أي بيانات ما لم تضفها أنت.</p></div><div class="welcome-actions"><button class="btn btn-primary" data-action="add-customer">إضافة أول عميل</button><button class="btn btn-secondary" data-link="/dashboard/devices">ربط جهاز</button></div></section>` : ""}
    ${statGrid([
      { title: "إجمالي الاشتراكات", value: stats.totalSubscriptions, caption: "اشتراك", tone: "info", icon: "subscriptions" },
      { title: "التجديدات القادمة", value: stats.upcomingRenewals, caption: "خلال 7 أيام", tone: "warning", icon: "reports" },
      { title: "العملاء النشطون", value: stats.activeCustomers, caption: "عميل", tone: "success", icon: "customers" },
      { title: "حالة واتساب", value: stats.connectedDevices > 0 ? "متصل" : "غير متصل", caption: `${stats.connectedDevices} جهاز`, tone: stats.connectedDevices > 0 ? "success" : "neutral", icon: "devices" },
      { title: "معدل التسليم", value: `${stats.deliveryRate || 0}%`, caption: `${stats.totalMessages || 0} رسالة`, tone: "purple", icon: "reports" }
    ])}
    <section class="quick-actions section"><div class="section-head"><div><h2>إجراءات سريعة</h2><p class="muted">ابدأ المهمة مباشرة من هنا.</p></div></div><div class="quick-action-grid">
      <button class="quick-action" data-action="add-subscription">${dashboardIcon("subscriptions")}<span>إضافة اشتراك جديد</span></button>
      <button class="quick-action" data-action="add-customer">${dashboardIcon("customers")}<span>إضافة عميل</span></button>
      <button class="quick-action" data-link="/dashboard/devices">${dashboardIcon("devices")}<span>ربط جهاز جديد</span></button>
      <button class="quick-action" data-action="send-message" ${alertDisabled} title="${alertDisabled ? "اربط جهازًا أولًا حتى تتمكن من إرسال التنبيهات." : "إرسال تنبيه"}">${dashboardIcon("reports")}<span>إرسال تنبيه</span></button>
      <button class="quick-action" data-link="/dashboard/security">${dashboardIcon("security")}<span>قائمة إيقاف الرسائل</span></button>
    </div></section>
    <div class="section dashboard-two-column">
      <article class="card table-card"><div class="section-head"><div><h2>أحدث الاشتراكات</h2><p class="muted">بيانات حقيقية تخص مساحة عملك فقط.</p></div><button class="text-button" data-link="/dashboard/subscriptions">عرض الكل</button></div>${latestContent}</article>
      <article class="card chart-card"><div class="section-head"><div><h2>أداء الإيرادات</h2><p class="muted">آخر 6 أشهر</p></div></div>${performanceChart(state.dashboardOverview?.monthlyPerformance || [])}</article>
    </div>
    <article class="card table-card section"><div class="section-head"><div><h2>أحدث النشاطات</h2><p class="muted">العمليات الفعلية داخل الحساب.</p></div><button class="text-button" data-link="/dashboard/reports">سجل النشاط</button></div>${activities.length ? activityList(activities) : emptyState("لا توجد نشاطات بعد", "ستظهر العمليات التي تنفذها داخل المنصة هنا.")}</article>`);
}

function pageTitle(title, actions = "") {
  const descriptions = {
    "الرئيسية": "ملخص أعمالك الحقيقي من قاعدة البيانات.",
    "إدارة الاشتراكات": "تابع الاشتراكات والتجديدات في مكان واحد.",
    "العملاء": "أدر عملاءك وتنبيهاتهم دون بيانات تجريبية.",
    "الأجهزة": "اربط واتساب وتحقق من حالة الاتصال الفعلية.",
    "الحماية": "قواعد الإرسال الآمن وقائمة إيقاف الرسائل.",
    "التقارير": "المؤشرات وسجل النشاط والفوترة.",
    "الإعدادات": "إدارة الحساب واللغة والمظهر والأمان."
  };
  return `<div class="page-title"><div><h1>${title}</h1><p class="muted">${descriptions[title] || "RenewPilot AI"}</p></div><div class="toolbar">${actions}</div></div>`;
}

function activityList(items = []) {
  return `<div class="activity-list">${items.map((item) => `<div class="activity-item"><span class="activity-dot"></span><div><strong>${escapeHtml(item.title || item.type || "نشاط")}</strong><p class="muted">${escapeHtml(item.createdAt ? new Date(item.createdAt).toLocaleString(state.language === "ar" ? "ar-SA" : "en-US") : "")}</p></div></div>`).join("")}</div>`;
}

function barsChart(values) {
  return `<div class="bars">${values.map((v, i) => `<div class="bar" style="height:${v}%"><span>${["ينا", "فبر", "مار", "أبر", "ماي", "يون", "يول", "أغس"][i]}</span></div>`).join("")}</div>`;
}

function readinessPage() {
  const report = state.readiness;
  if (report === null) return dashboardShell(`${pageTitle("فحص الجاهزية", `<button class="btn btn-primary" data-action="run-readiness">تشغيل اختبار شامل</button>`)}<div class="loading-state">جاري فحص حالة المنصة...</div>`);
  if (report?.error) return dashboardShell(`${pageTitle("فحص الجاهزية", `<button class="btn btn-primary" data-action="run-readiness">إعادة الفحص</button>`)}${emptyState(escapeHtml(report.error))}`);
  const labels = { database: "قاعدة البيانات", evolution: "Evolution API", whatsapp: "اتصال واتساب", resend: "Resend", cron: "Cron", https: "HTTPS", environment: "متغيرات البيئة" };
  const cards = Object.entries(report.statuses || {}).map(([key, value]) => `<article class="card readiness-card"><div class="section-head"><h3>${labels[key] || key}</h3><span class="status ${value.ok ? "success" : "danger"}">${value.ok ? "جاهز" : "غير جاهز"}</span></div><strong>${escapeHtml(value.label || "")}</strong>${value.error ? `<p class="danger-text">${escapeHtml(value.error)}</p>` : ""}${value.missing?.length ? `<p class="muted">الناقص: ${value.missing.map(escapeHtml).join("، ")}</p>` : ""}</article>`).join("");
  return dashboardShell(`${pageTitle("فحص الجاهزية", `<button class="btn btn-primary" data-action="run-readiness">تشغيل اختبار شامل</button>`)}
    <div class="readiness-result ${report.result === "ready" ? "ready" : "not-ready"}"><strong>${report.result === "ready" ? "Ready" : "Not Ready"}</strong><span>آخر فحص: ${escapeHtml(report.checkedAt || "")}</span></div>
    <div class="grid grid-3">${cards}</div>
    <div class="grid grid-2 section"><article class="card table-card"><h3>آخر Webhook</h3>${report.lastWebhook ? `<strong>${escapeHtml(report.lastWebhook.title)}</strong><p class="muted">${escapeHtml(report.lastWebhook.createdAt)}</p>` : `<p class="muted">لا يوجد Webhook مسجل</p>`}</article><article class="card table-card"><h3>آخر نسخة احتياطية</h3>${report.lastBackup ? `<strong>${escapeHtml(report.lastBackup.title)}</strong><p class="muted">${escapeHtml(report.lastBackup.createdAt)}</p>` : `<p class="muted">لا توجد نسخة احتياطية مسجلة</p>`}</article></div>`);
}

function issuesPage() {
  const issues = state.operationalIssues;
  const content = issues === null ? `<div class="loading-state">جاري تحميل سجل المشاكل...</div>` : issues?.error ? emptyState(escapeHtml(issues.error)) : !issues.length ? emptyState("لا توجد مشاكل تشغيلية مسجلة") : `<div class="issue-list">${issues.map((issue) => `<article class="card issue-row"><div class="section-head"><div><span class="status ${issue.severity === "critical" || issue.severity === "error" ? "danger" : "warning"}">${escapeHtml(issue.category)}</span><h3>${escapeHtml(issue.message)}</h3></div><span class="status ${issue.status === "resolved" ? "success" : "danger"}">${issue.status === "resolved" ? "تم الحل" : "مفتوحة"}</span></div><p><strong>المصدر:</strong> ${escapeHtml(issue.source)}</p><p class="muted"><strong>الحل المقترح:</strong> ${escapeHtml(issue.suggestedSolution)}</p><small>${escapeHtml(issue.createdAt)}</small></article>`).join("")}</div>`;
  return dashboardShell(`${pageTitle("سجل المشاكل", `<button class="btn btn-secondary" data-action="reload-issues">تحديث السجل</button>`)}${content}`);
}

function subscriptionsPage() {
  const stats = overviewStats();
  const source = Array.isArray(state.dbSubscriptions) ? state.dbSubscriptions : [];
  const rows = filterRows(source, ["orderNumber", "customerName", "planName", "status"]);
  const content = state.dbSubscriptions?.error
    ? `<div class="empty-state"><strong>تعذر تحميل الاشتراكات</strong><p class="muted">${escapeHtml(state.dbSubscriptions.error)}</p><button class="btn btn-secondary" data-action="reload-subscriptions">إعادة المحاولة</button></div>`
    : state.dbSubscriptions === null
      ? `<div class="loading-state">جاري تحميل الاشتراكات من قاعدة البيانات...</div>`
      : rows.length ? subscriptionsTable(rows) : emptyState("لا توجد اشتراكات بعد", "ابدأ بإضافة أول اشتراك لإدارة التجديدات والتنبيهات.", "إضافة اشتراك", "add-subscription");
  return dashboardShell(`${pageTitle("إدارة الاشتراكات", `<button class="btn btn-primary" data-action="add-subscription">إضافة اشتراك</button><button class="btn btn-secondary" data-action="export-subscriptions">تصدير CSV</button>`)}
    ${statGrid([
      { title: "إجمالي الاشتراكات", value: stats.totalSubscriptions, caption: "اشتراك", tone: "info", icon: "subscriptions" },
      { title: "التجديدات خلال 7 أيام", value: stats.upcomingRenewals, caption: "قادم", tone: "warning", icon: "reports" },
      { title: "الاشتراكات المنتهية", value: stats.expiredSubscriptions, caption: "منتهي", tone: "danger", icon: "security" },
      { title: "الإيراد الشهري", value: formatMoney(stats.monthlyRevenue), caption: "من الاشتراكات", tone: "success", icon: "reports" }
    ])}
    ${tableToolbar(["الكل", "active", "expiring_soon", "expired", "paused", "renewed"])}
    <article class="card table-card">${content}</article>`);
}

function subscriptionsTable(rows, compact = false) {
  const head = compact ? ["رقم الطلب", "العميل", "الباقة", "تاريخ الانتهاء", "الحالة"] : ["رقم الطلب", "العميل", "الباقة / الخدمة", "تاريخ البداية", "تاريخ الانتهاء", "الحالة", "الإجراء"];
  const body = rows.map((row) => {
    const disabled = row.canSend ? "" : "disabled";
    const reason = row.whatsappStatus !== "connected" ? "يجب ربط واتساب أولًا" : Number(row.riskScore) > 70 ? "الإرسال متوقف بسبب ارتفاع المخاطر" : row.remindersPaused ? "التذكيرات موقوفة لهذا العميل" : "";
    const actions = `<div class="subscription-actions">
      <button class="btn btn-primary" data-action="mark-renewed" data-id="${row.id}">تم التجديد</button>
      <button class="btn btn-secondary" data-action="send-subscription-reminder" data-id="${row.id}" ${disabled} title="${escapeHtml(reason)}">إرسال تذكير</button>
      <button class="btn btn-ghost icon-only" data-action="subscription-edit-db" data-id="${row.id}" title="تعديل">${dashboardIcon("settings")}</button>
      <button class="btn btn-ghost icon-only danger-text" data-action="subscription-delete-db" data-id="${row.id}" title="حذف">×</button>
    </div>`;
    if (compact) return `<tr><td>${escapeHtml(row.orderNumber)}</td><td>${escapeHtml(row.customerName)}</td><td>${escapeHtml(row.planName)}</td><td>${escapeHtml(String(row.endDate).slice(0, 10))}</td><td>${status(row.status)}</td></tr>`;
    return `<tr><td>${escapeHtml(row.orderNumber)}</td><td>${escapeHtml(row.customerName)}</td><td><strong>${escapeHtml(row.planName)}</strong><small>${escapeHtml(row.serviceName)}</small></td><td>${escapeHtml(String(row.startDate).slice(0, 10))}</td><td>${escapeHtml(String(row.endDate).slice(0, 10))}</td><td>${status(row.status)}</td><td>${actions}</td></tr>`;
  }).join("");
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
  const stats = overviewStats();
  const source = Array.isArray(state.dbCustomers) ? state.dbCustomers : [];
  const rows = filterRows(source, ["name", "email", "phone", "serviceName", "status"]);
  const recentNotifications = state.dashboardOverview?.recentNotifications || [];
  const content = state.dbCustomers?.error ? emptyState("تعذر تحميل العملاء", escapeHtml(state.dbCustomers.error)) : state.dbCustomers === null ? `<div class="loading-state">جاري تحميل العملاء...</div>` : rows.length ? customersTable(rows) : emptyState("لا يوجد عملاء بعد", "أضف أول عميل لبدء إدارة الاشتراكات والتنبيهات.", "إضافة عميل", "add-customer");
  const sendDisabled = stats.connectedDevices > 0 ? "" : "disabled";
  return dashboardShell(`${pageTitle("العملاء", `<button class="btn btn-primary" data-action="add-customer">إضافة عميل</button><button class="btn btn-secondary" data-action="import-customers">استيراد CSV</button><button class="btn btn-secondary" data-action="export-customers">تصدير CSV</button>`)}
    ${statGrid([
      { title: "إجمالي العملاء", value: stats.totalCustomers, caption: "عميل", tone: "info", icon: "customers" },
      { title: "النشطون اليوم", value: stats.activeToday, caption: "اليوم", tone: "success", icon: "customers" },
      { title: "العملاء المميزون", value: 0, caption: "حسب التصنيف", tone: "purple", icon: "customers" },
      { title: "معدل الاستجابة", value: `${stats.deliveryRate || 0}%`, caption: "من التنبيهات", tone: "warning", icon: "reports" }
    ])}
    ${tableToolbar(["الكل", "active", "inactive"])}
    <article class="card table-card">${content}</article>
    <article class="card table-card section"><div class="section-head"><div><h2>أحدث التنبيهات</h2><p class="muted">رسائل العملاء المسجلة فعليًا.</p></div><button class="btn btn-secondary" data-action="send-message" ${sendDisabled} title="${sendDisabled ? "اربط جهازًا أولًا حتى تتمكن من إرسال التنبيهات." : "إرسال تنبيه"}">إرسال تنبيه</button></div>${recentNotifications.length ? `<div class="notification-list">${recentNotifications.map((item) => `<div class="activity-item"><span class="activity-dot"></span><div><strong>${escapeHtml(item.customerName || item.toNumber || "تنبيه")}</strong><p class="muted">${escapeHtml(item.channel)} · ${escapeHtml(item.createdAt ? new Date(item.createdAt).toLocaleString("ar-SA") : "")}</p></div>${status(item.status)}</div>`).join("")}</div>` : emptyState("لا توجد تنبيهات بعد", "ستظهر سجلات التنبيهات بعد أول عملية إرسال.")}</article>`);
}

function customersTable(rows) {
  if (!rows.length) return emptyState("لا يوجد عملاء مطابقون", "غيّر البحث أو الفلترة.");
  const body = rows.map((row) => `<tr><td><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(row.email || "")}</small></td><td>${escapeHtml(row.phone || "غير مضاف")}</td><td>${escapeHtml(row.serviceName || "لا توجد خدمة")}</td><td>${escapeHtml(row.lastRenewal ? String(row.lastRenewal).slice(0, 10) : "-")}</td><td>${status(row.status)}</td><td>${escapeHtml((row.tags || []).join("، ") || "-")}</td><td><div class="inline-actions"><button class="btn btn-secondary" data-action="customer-details-db" data-id="${row.id}">عرض</button><button class="btn btn-ghost icon-only" data-action="customer-edit-db" data-id="${row.id}" title="تعديل">${dashboardIcon("settings")}</button><button class="btn btn-ghost icon-only danger-text" data-action="customer-delete-db" data-id="${row.id}" title="حذف">×</button></div></td></tr>`).join("");
  return `<div class="compare"><table><thead><tr>${["الاسم", "الهاتف", "الخدمة", "آخر تجديد", "الحالة", "الملاحظات", "الإجراء"].map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function reportsPage() {
  const stats = overviewStats();
  const activities = (state.dashboardOverview?.activities || []).filter((item) => !String(item.type || "").startsWith("auth."));
  const profile = state.dashboardOverview?.profile || {};
  const reportRows = (state.dashboardOverview?.monthlyPerformance || []).slice(-Number(state.reportPeriod || 6));
  return dashboardShell(`${pageTitle("التقارير", `<select class="select report-period" data-action="report-period"><option value="6" ${state.reportPeriod === "6" ? "selected" : ""}>آخر 6 أشهر</option><option value="3" ${state.reportPeriod === "3" ? "selected" : ""}>آخر 3 أشهر</option><option value="1" ${state.reportPeriod === "1" ? "selected" : ""}>هذا الشهر</option></select><button class="btn btn-primary" data-action="export-report">تصدير التقرير</button>`)}
    ${statGrid([
      { title: "الإيراد الشهري", value: formatMoney(stats.monthlyRevenue), caption: "حالي", tone: "success", icon: "reports" },
      { title: "الرسائل المرسلة", value: stats.sentMessages, caption: "رسالة", tone: "info", icon: "subscriptions" },
      { title: "نسبة النجاح", value: `${stats.successRate || 0}%`, caption: "من إجمالي الرسائل", tone: "purple", icon: "reports" },
      { title: "العملاء المتجددون", value: stats.renewedCustomers, caption: "عميل", tone: "warning", icon: "customers" }
    ])}
    <article class="card chart-card section"><div class="section-head"><div><h2>رسم الأداء</h2><p class="muted">بيانات الاشتراكات للفترة المحددة.</p></div></div>${performanceChart(reportRows)}</article>
    <div class="section dashboard-two-column">
      <article class="card table-card"><div class="section-head"><div><h2>سجل النشاط</h2><p class="muted">آخر العمليات داخل مساحة العمل.</p></div></div>${activities.length ? activityList(activities) : emptyState("لا توجد نشاطات بعد", "ستظهر العمليات الفعلية هنا بعد استخدام المنصة.")}</article>
      <article class="card table-card"><div class="section-head"><div><h2>الفوترة والباقات</h2><p class="muted">الخطة الحالية والفواتير.</p></div><span class="plan-badge">${escapeHtml(profile.planName || "Free Trial")}</span></div>${emptyState("لا توجد فواتير بعد", "ستظهر الفواتير هنا عند إصدار أول فاتورة.", "عرض خطط الأسعار", "/pricing")}</article>
    </div>`);
}

function securityPage() {
  const stats = overviewStats();
  const list = Array.isArray(state.unsubscribes) ? state.unsubscribes : [];
  const health = state.whatsappHealth?.health || null;
  const securityLevel = stats.safeRules > 0 ? 100 : 0;
  const listContent = state.unsubscribes?.error
    ? emptyState("تعذر تحميل قائمة الإيقاف", escapeHtml(state.unsubscribes.error))
    : state.unsubscribes === null
      ? `<div class="loading-state">جاري تحميل قائمة الإيقاف...</div>`
      : list.length
        ? simpleTable(["الرقم", "السبب", "المصدر", "التاريخ", "الإجراء"], list.map((item) => [escapeHtml(item.phoneNumber), escapeHtml(item.reason || "-"), escapeHtml(item.source || "يدوي"), escapeHtml(item.unsubscribedAt ? new Date(item.unsubscribedAt).toLocaleDateString("ar-SA") : "-"), `<button class="btn btn-ghost danger-text" data-action="remove-unsubscribe" data-id="${item.id}">حذف</button>`]))
        : emptyState("لا توجد أرقام محظورة", "لم تتم إضافة أي رقم إلى قائمة إيقاف الرسائل.", "إضافة رقم", "add-unsubscribe");
  const healthLabel = health ? ({ excellent: "ممتاز", good: "جيد", medium: "متوسط", danger: "خطر" }[health.status] || health.status) : "لم يتم الفحص بعد";
  return dashboardShell(`${pageTitle("الحماية", `<button class="btn btn-primary" data-action="add-unsubscribe">إضافة رقم</button><button class="btn btn-secondary" data-action="export-unsubscribes">تصدير</button>`)}
    ${statGrid([
      { title: "مستوى الأمان", value: `${securityLevel}%`, caption: securityLevel ? "مكتمل" : "غير مكتمل", tone: securityLevel ? "success" : "neutral", icon: "security" },
      { title: "الأرقام المحظورة", value: stats.blockedNumbers, caption: "رقم", tone: "danger", icon: "customers" },
      { title: "قواعد الإرسال الآمن", value: stats.safeRules, caption: "قاعدة نشطة", tone: "info", icon: "security" },
      { title: "حالة الفحص", value: healthLabel, caption: health?.lastDisconnect ? "تم الفحص" : "", tone: health ? "success" : "neutral", icon: "reports" }
    ])}
    <div class="section dashboard-two-column">
      <article class="card table-card"><div class="section-head"><div><h2>قائمة إيقاف الرسائل</h2><p class="muted">الأرقام التي لن تستقبل أي رسالة.</p></div><button class="btn btn-secondary" data-action="import-unsubscribes">استيراد قائمة</button></div>${listContent}</article>
      <article class="card table-card"><div class="section-head"><div><h2>مركز حماية واتساب</h2><p class="muted">النتيجة محسوبة من القناة الفعلية.</p></div></div>${health ? `<div class="risk-summary"><strong>${Number(health.risk || 0)}</strong><span>/100</span></div><p class="status ${Number(health.risk || 0) > 70 ? "danger" : Number(health.risk || 0) > 35 ? "warning" : "success"}">${healthLabel}</p><p>${escapeHtml(health.advice || "")}</p>${Number(health.risk || 0) > 70 ? `<button class="btn btn-danger" data-action="review-risks">مراجعة المخاطر</button>` : ""}` : emptyState("لم يتم الفحص بعد", "اربط جهاز واتساب أولًا لاحتساب مستوى المخاطر.", "الانتقال إلى الأجهزة", "/dashboard/devices")}</article>
    </div>
    <article class="card table-card section"><div class="section-head"><div><h2>مركز الضمان وسياسة الإرسال</h2><p class="muted">لا توجد حالات أو سياسات مخصصة حتى تضيفها من بياناتك.</p></div><button class="btn btn-secondary" data-action="policy-details">عرض تفاصيل السياسة</button></div>${emptyState("لا توجد حالات ضمان بعد", "ستظهر الحالات المسجلة فعليًا في هذا القسم.")}</article>`);
}

function connectedDevicesCenterPage() {
  const device = { ...defaultLinkedDevice, ...state.linkedDevice };
  const stats = overviewStats();
  const health = state.whatsappHealth?.health || null;
  const isConnected = device.status === "connected";
  const hasRealQr = isRealQrDataUri(device.qrBase64);
  const hasQrSession = ["pending_qr", "connecting"].includes(device.status);
  const isPendingQr = hasQrSession && hasRealQr && device.qrImageLoaded;
  const isQrRendering = hasQrSession && hasRealQr && !device.qrImageLoaded;
  const isQrExpired = hasQrSession && !hasRealQr;
  const isPendingPairing = device.status === "pending_pairing" && Boolean(device.pairingCode);
  const method = device.linkMethod || "qr";
  const statusText = isConnected ? "متصل الآن" : isPendingQr ? "بانتظار مسح الباركود" : isQrRendering ? "جاري عرض الباركود" : isQrExpired ? "انتهت صلاحية الباركود" : isPendingPairing ? "بانتظار إدخال رمز الاقتران" : device.status === "disconnected" ? "غير متصل" : "غير مربوط";
  const statusTone = isConnected ? "success" : isPendingQr || isQrRendering || isQrExpired || isPendingPairing ? "warning" : "danger";
  const qrImage = hasRealQr
    ? `<img class="qr-real" src="${device.qrBase64}" alt="باركود ربط واتساب">`
    : `<div class="qr-empty"><strong>لا يوجد باركود صالح</strong><p class="muted">أنشئ باركود حقيقي من Evolution API.</p></div>`;
  const activity = device.activity?.length ? device.activity : [];
  const connectedTable = simpleTable(["الجهاز", "رقم واتساب", "الحالة", "آخر فحص", "آخر إرسال", "الإجراءات"], [[device.deviceName || "غير متوفر", device.phoneNumber || "غير متوفر", status("نشط"), device.lastCheckAt || "لم يتم الفحص", device.lastSendAt || "لم يتم الإرسال", `<button class="btn btn-secondary" data-action="check-device-connection">فحص</button>`]]);

  return dashboardShell(`${pageTitle("الأجهزة", `<button class="btn btn-primary" data-action="create-device-qr" ${device.qrLoading ? "disabled" : ""}>${device.qrLoading ? "جاري إنشاء الباركود..." : "إنشاء/تحديث باركود"}</button>`)}
    ${statGrid([
      { title: "الأجهزة المتصلة", value: stats.connectedDevices, caption: "جهاز", tone: isConnected ? "success" : "neutral", icon: "devices" },
      { title: "بانتظار الربط", value: stats.pendingDevices, caption: "جلسة", tone: "warning", icon: "devices" },
      { title: "جودة الاتصال", value: isConnected ? "100%" : "0%", caption: statusText, tone: isConnected ? "success" : "neutral", icon: "reports" },
      { title: "آخر فحص", value: device.lastCheckAt || "لم يتم", caption: "فحص الاتصال", tone: "info", icon: "security" }
    ])}
    <p class="linked-subtitle">قم بربط واتساب وإدارة أجهزتك المرتبطة بأمان لتواصل فعال مع عملائك.</p>
    <section class="linked-layout" data-device-status="${device.status}" data-link-method="${method}">
      <article class="card linked-main-card">
        <div class="device-art" aria-hidden="true">
          <div class="phone-frame"><span class="wa-logo">☎</span></div>
          <div class="wa-check ${isConnected ? "show" : ""}">✓</div>
          <div class="qr-float">${hasRealQr ? qrImage : `<div class="qr-unavailable">QR</div>`}</div>
        </div>
        <div class="link-panel">
          <div class="section-head compact-head">
            <div><h2>ربط واتساب</h2><p class="muted">${isConnected ? "تم ربط حساب واتساب وجاهز لإرسال تنبيهات وتجديدات العملاء." : "اربط حساب واتساب لإدارة المحادثات والرد على العملاء مباشرة من المنصة."}</p><p class="muted lock-line">🔒 آمن، خاص، ومتوافق مع سياسات واتساب.</p></div>
            <span class="status ${statusTone}">${statusText}</span>
          </div>
          <div class="tabs tabs-row link-tabs">
            <button class="tab ${method === "qr" ? "active" : ""}" data-action="device-link-method" data-method="qr">الربط بالباركود QR</button>
            <button class="tab ${method === "pairing" ? "active" : ""}" data-action="device-link-method" data-method="pairing">الربط برمز الاقتران${device.pairingSupported === false ? " · غير مدعوم حاليًا" : ""}</button>
          </div>
          ${method === "qr" ? `<div class="link-box-grid">
            <div class="qr-box ${isPendingQr ? "active" : ""}" data-action="show-device-qr">
              ${qrImage}
              <strong>${device.qrLoading ? "جاري طلب الباركود من Evolution API..." : hasRealQr && !device.qrImageLoaded ? "جاري التحقق من صورة الباركود..." : isPendingQr ? "الباركود جاهز للمسح" : isConnected ? "الجهاز متصل" : "لا يوجد باركود صالح"}</strong>
              <small class="muted">${isPendingQr ? `ينتهي خلال 60 ثانية - صالح حتى ${device.qrExpiresAt}` : hasRealQr ? "يتم تحميل الصورة والتحقق منها داخل المتصفح." : device.qrError ? escapeHtml(device.qrError) : "اضغط إنشاء باركود جديد."}</small>
            </div>
            <div class="pair-code">
              <span class="muted">رمز الاقتران</span>
              <strong>${device.pairingCode || "غير متوفر"}</strong>
              <small class="muted">لا يظهر الرمز إلا بعد طلبه من Evolution API</small>
              <button class="btn btn-primary" data-action="create-device-qr" ${device.qrLoading ? "disabled" : ""}>${device.qrLoading ? "جاري التحميل..." : "إنشاء/تحديث باركود"}</button>
              <button class="btn btn-secondary" data-action="copy-pairing">نسخ رمز الاقتران</button>
              <button class="btn btn-secondary" data-action="check-device-connection" ${!isPendingQr && !isConnected ? "disabled" : ""}>فحص الاتصال</button>
            </div>
          </div>` : device.pairingSupported === false ? `<div class="pairing-unsupported">
            <p class="status warning">رمز الاقتران غير مدعوم حاليًا في نسخة Evolution API المثبتة. يمكنك استخدام الربط بالباركود.</p>
            <button class="btn btn-primary" data-action="device-link-method" data-method="qr">استخدام الباركود بدلًا من ذلك</button>
          </div>` : `<div class="link-box-grid pairing-layout">
            <div class="pairing-form">
              <label class="field"><span>رقم واتساب</span><input class="input" data-action="pairing-phone-input" value="${device.phoneInput || ""}" placeholder="9665XXXXXXXX" inputmode="numeric"></label>
              <small class="muted">اكتب الرقم بصيغة دولية بدون + أو مسافات، مثال: 9665XXXXXXXX.</small>
              <button class="btn btn-primary" data-action="create-pairing-code" ${device.pairingLoading ? "disabled" : ""}>${device.pairingLoading ? "جاري إنشاء رمز الاقتران..." : "إنشاء رمز الاقتران"}</button>
              ${device.pairingError ? `<p class="status danger" data-pairing-error>${escapeHtml(device.pairingError)}</p>` : ""}
            </div>
            <div class="pair-code pairing-result">
              <span class="muted">رمز الاقتران</span>
              <strong>${isPendingPairing ? device.pairingCode : "لا يوجد رمز بعد"}</strong>
              <small class="muted">${isPendingPairing ? `ينتهي خلال 60 ثانية - صالح حتى ${device.pairingExpiresAt}` : "سيظهر الرمز بعد إدخال رقم صحيح"}</small>
              <button class="btn btn-secondary" data-action="copy-pairing" ${!isPendingPairing ? "disabled" : ""}>نسخ الرمز</button>
              <button class="btn btn-secondary" data-action="check-device-connection" ${!isPendingPairing && !isConnected ? "disabled" : ""}>فحص الاتصال</button>
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
      <article class="card usage-card"><span class="mini-icon">${dashboardIcon("devices")}</span><h3>استخدام الأجهزة المرتبطة</h3><strong class="usage-count">${stats.connectedDevices} جهاز متصل</strong><div class="usage-bar"><span style="width:${isConnected ? 100 : 0}%"></span></div><p class="${isConnected ? "success-text" : "muted"}">${isConnected ? "تم ربط جهاز واتساب بنجاح" : "لم يتم ربط أي جهاز بعد"}</p></article>
      <article class="card table-card security-card"><span class="mini-icon">🛡</span><h3>ملاحظات الأمان</h3><ul class="check-list">${["الاتصال مشفر بالكامل بين منصتك وواتساب.", "لا يتم تخزين أو عرض أي رموز أو توكنات.", "عند انتهاء الجلسة، سيتم طلب إعادة الربط.", "أوقف أي جهاز غير معروف من إعدادات واتساب."].map((item) => `<li>${item}</li>`).join("")}</ul></article>
      <article class="card table-card linked-table-card"><h3>الأجهزة المرتبطة الأخيرة</h3>${isConnected ? connectedTable : `<div class="empty-device"><div class="empty-icon">🔗</div><strong>لا توجد أجهزة مرتبطة حتى الآن</strong><p class="muted">قم بربط واتساب لعرض الأجهزة المرتبطة وسجل النشاط.</p></div>`}</article>
      <article class="card table-card activity-card"><h3>النشاط الأخير</h3>${activity.length ? `<div class="activity-list">${activity.map((item) => `<div class="activity-item"><span class="activity-dot"></span><div><strong>${escapeHtml(item)}</strong><p class="muted">تم التحديث الآن</p></div></div>`).join("")}</div>` : emptyState("لا توجد نشاطات بعد", "ستظهر عمليات الربط والفحص هنا.")}</article>
    </section>
    <section class="section section-tight health-and-safety"><article class="card table-card number-health-card"><div class="section-head"><div><h3>${t("linkedDevices.health")}</h3><p class="muted">${t("linkedDevices.safeSending")}</p></div><span class="health-score">${health ? 100 - Number(health.risk || 0) : 0}/100</span></div>${health ? `<div class="health-metrics"><span><small>${t("linkedDevices.messagesToday")}</small><strong>${health.messagesToday || 0}</strong></span><span><small>${t("linkedDevices.messagesHour")}</small><strong>${health.messagesHour || 0}</strong></span><span><small>${t("linkedDevices.failureRate")}</small><strong>${health.failureRate || 0}%</strong></span><span><small>${t("linkedDevices.unsubscribeCount")}</small><strong>${health.unsubscribeCount || 0}</strong></span><span><small>${t("linkedDevices.riskScore")}</small><strong>${health.risk || 0}/100</strong></span></div><div class="secure-note"><strong>${t("linkedDevices.smartAdvice")}:</strong> ${escapeHtml(health.advice || "")}</div>` : emptyState("لا توجد نتيجة فحص بعد", "اربط الجهاز وافحص الاتصال لعرض مؤشرات الصحة.")}</article><article class="card table-card safe-mode-card"><h3>وضع الإرسال الآمن</h3>${stats.safeRules > 0 ? `<p><strong>${stats.safeRules}</strong> قواعد نشطة من قاعدة البيانات.</p><button class="btn btn-secondary" data-link="/dashboard/security">إدارة القواعد</button>` : emptyState("لا توجد قواعد إرسال آمن", "أضف قواعدك من صفحة الحماية.", "فتح الحماية", "/dashboard/security")}</article></section>`);
}

function settingsPage() {
  const remote = state.accountSettings?.settings || state.dashboardOverview?.profile || {};
  const notifications = remote.notificationChannels || {};
  const security = remote.security || {};
  return dashboardShell(`${pageTitle("الإعدادات", `<button class="btn btn-primary" data-action="save-settings">حفظ التغييرات</button>`)}
    <div class="settings-layout">
      <article class="card settings-panel"><div class="settings-panel-head">${dashboardIcon("customers")}<div><h2>إعدادات الحساب</h2><p class="muted">بيانات المستخدم الحالي.</p></div></div><form data-submit="profile-settings" class="form-grid"><label class="field"><span>الاسم</span><input class="input" name="name" value="${escapeHtml(remote.name || "")}" required></label><label class="field"><span>البريد الإلكتروني</span><input class="input" value="${escapeHtml(remote.email || "")}" disabled></label><button class="btn btn-primary">حفظ الملف الشخصي</button></form></article>
      <article class="card settings-panel"><div class="settings-panel-head">${dashboardIcon("settings")}<div><h2>اللغة والمظهر</h2><p class="muted">تحفظ التفضيلات للحساب والمتصفح.</p></div></div><div class="setting-row"><span>اللغة</span><div class="segmented"><button class="${state.language === "ar" ? "active" : ""}" data-action="set-language" data-value="ar">AR</button><button class="${state.language === "en" ? "active" : ""}" data-action="set-language" data-value="en">EN</button></div></div><div class="setting-row"><span>المظهر</span><div class="segmented"><button class="${state.theme === "light" ? "active" : ""}" data-action="set-theme" data-value="light">شمسي</button><button class="${state.theme === "dark" ? "active" : ""}" data-action="set-theme" data-value="dark">ليلي</button></div></div></article>
      <article class="card settings-panel"><div class="settings-panel-head">${dashboardIcon("security")}<div><h2>الأمان</h2><p class="muted">كلمة المرور والمصادقة الثنائية.</p></div></div>${settingToggle("twoFactor", "المصادقة الثنائية (2FA)", Boolean(security.twoFactor))}<button class="btn btn-secondary" data-action="change-password">تغيير كلمة المرور</button><button class="btn btn-secondary" data-action="manage-sessions">إدارة الجلسات</button></article>
      <article class="card settings-panel"><div class="settings-panel-head">${dashboardIcon("subscriptions")}<div><h2>الإشعارات</h2><p class="muted">اختر القنوات التي تريد تفعيلها.</p></div></div>${settingToggle("whatsapp", "واتساب", Boolean(notifications.whatsapp))}${settingToggle("email", "البريد الإلكتروني", Boolean(notifications.email))}${settingToggle("sms", "الرسائل النصية", Boolean(notifications.sms))}</article>
      <article class="card settings-panel"><div class="settings-panel-head">${dashboardIcon("reports")}<div><h2>إعدادات النظام</h2><p class="muted">قواعد التشغيل الخاصة بالحساب.</p></div></div>${settingToggle("renewAuto", "التجديد التلقائي", Boolean(security.renewAuto))}<button class="btn btn-secondary" data-link="/dashboard/security">إدارة سياسة الإرسال</button></article>
      <article class="card settings-panel session-card"><div class="settings-panel-head">${dashboardIcon("settings")}<div><h2>الجلسة الحالية</h2><p class="muted">${escapeHtml(remote.email || "")}</p></div></div><span class="status success">نشطة</span><button class="btn btn-danger" data-action="logout-confirm">تسجيل الخروج</button></article>
    </div>`);
}

function settingToggle(key, label, checked = state.settings[key]) {
  return `<label class="setting-row setting-toggle"><span>${label}</span><input type="checkbox" data-action="setting-toggle" data-key="${key}" ${checked ? "checked" : ""}></label>`;
}

function simpleTable(headers, rows) {
  return `<div class="compare"><table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function emptyState(title, description = "ابدأ بإضافة أول عنصر لتظهر البيانات هنا.", actionLabel = "", action = "") {
  return `<div class="empty-state"><span class="empty-state-icon">${dashboardIcon("reports")}</span><strong>${title}</strong><p>${description}</p>${actionLabel ? `<button class="btn btn-primary" ${action.startsWith("/") ? `data-link="${action}"` : `data-action="${action}"`}>${actionLabel}</button>` : ""}</div>`;
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

function subscriptionForm(row = {}, editId = "") {
  const customers = Array.isArray(state.dbCustomers) ? state.dbCustomers : [];
  if (!customers.length) return emptyState("أضف عميلًا أولًا", "يجب اختيار عميل حقيقي قبل إنشاء الاشتراك.", "إضافة عميل", "add-customer");
  return `<form data-submit="subscription" data-id="${editId}" class="form-grid">
    <label class="field"><span>العميل</span><select class="select" name="customerId" ${editId ? "disabled" : ""} required>${customers.map((customer) => `<option value="${customer.id}" ${row.customerId === customer.id ? "selected" : ""}>${escapeHtml(customer.name)}</option>`).join("")}</select></label>
    ${field("رقم الطلب (اختياري)", "orderNumber", "text", row.orderNumber || "", false)}
    ${field("نوع الخدمة", "serviceName", "text", row.serviceName || "")}
    ${field("الباقة", "planName", "text", row.planName || "")}
    ${field("تاريخ البداية", "startDate", "date", row.startDate ? String(row.startDate).slice(0, 10) : "")}
    ${field("تاريخ النهاية", "endDate", "date", row.endDate ? String(row.endDate).slice(0, 10) : "")}
    ${field("رابط التجديد", "renewalUrl", "url", row.renewalUrl || "", false)}
    ${field("القيمة (ر.س)", "price", "number", row.price || "0", false)}
    <label class="field"><span>الحالة</span><select class="select" name="status">${[["active", "نشط"], ["expiring_soon", "ينتهي قريبًا"], ["expired", "منتهي"], ["paused", "موقوف"], ["renewed", "تم التجديد"]].map(([value, label]) => `<option value="${value}" ${row.status === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>
    <label class="field full-span"><span>ملاحظات</span><textarea class="textarea" name="notes">${escapeHtml(row.notes || "")}</textarea></label>
    <div class="inline-actions"><button class="btn btn-primary">حفظ</button><button type="button" class="btn btn-secondary" data-action="close-modal">إلغاء</button></div>
  </form>`;
}

function customerForm(row = {}, editId = "") {
  return `<form data-submit="customer" data-id="${editId}" class="form-grid">
    ${field("اسم العميل", "name", "text", row.name || "")}
    ${field("البريد الإلكتروني", "email", "email", row.email || "", false)}
    ${field("رقم الجوال", "phone", "tel", row.phone || "", false)}
    <label class="field"><span>الحالة</span><select class="select" name="status"><option value="active" ${row.status === "active" ? "selected" : ""}>نشط</option><option value="inactive" ${row.status === "inactive" ? "selected" : ""}>غير نشط</option></select></label>
    <label class="field full-span"><span>ملاحظات / تصنيفات</span><input class="input" name="tags" value="${escapeHtml(Array.isArray(row.tags) ? row.tags.join("، ") : "")}" placeholder="مثال: عميل مميز، متجر"></label>
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

async function saveAccountSettings(overrides = {}) {
  const remote = state.accountSettings?.settings || state.dashboardOverview?.profile || {};
  const notificationChannels = { ...(remote.notificationChannels || {}) };
  const security = { ...(remote.security || {}) };
  for (const key of ["whatsapp", "email", "sms"]) {
    if (Object.hasOwn(state.settings, key)) notificationChannels[key] = Boolean(state.settings[key]);
  }
  for (const key of ["twoFactor", "renewAuto"]) {
    if (Object.hasOwn(state.settings, key)) security[key] = Boolean(state.settings[key]);
  }
  try {
    await fetchJson("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: overrides.name || remote.name || undefined,
        language: state.language,
        theme: state.theme,
        notificationChannels,
        security
      })
    });
    state.accountSettings = null;
    state.dashboardOverview = null;
    await syncRouteData(true);
    toast("تم حفظ التغييرات بنجاح");
  } catch (error) { toast(error.message || "تعذر حفظ الإعدادات", "danger"); }
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
      closePortal();
      toast(t("auth.logoutSuccess"));
      navigate("/login");
    };
    fetch("/api/auth/logout", { method: "POST", credentials: "include" }).finally(finishLogout);
  }
  if (action === "device-link-method") {
    state.linkedDevice = { ...state.linkedDevice, linkMethod: target.dataset.method };
    render();
  }
  if (action === "create-pairing-code") {
    let phone = String(state.linkedDevice.phoneInput || "").replace(/\D/g, "");
    if (/^05\d{8}$/.test(phone)) phone = `966${phone.slice(1)}`;
    if (!phone) return toast("يرجى إدخال رقم واتساب.", "danger");
    if (!/^[1-9]\d{9,14}$/.test(phone)) return toast("اكتب الرقم بصيغة دولية بدون + أو مسافات.", "danger");
    state.linkedDevice = { ...state.linkedDevice, phoneInput: phone, pairingLoading: true, pairingError: "", pairingCode: "" };
    render();
    const requestSignal = AbortSignal.timeout(20_000);
    try {
      const instance = await ensureEvolutionInstance({ signal: requestSignal, timeoutMessage: "استغرق Evolution وقتًا أطول من المتوقع. حاول مرة أخرى." });
      const payload = await fetchJson(`/api/whatsapp/instances/${instance.instanceId}/pairing-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: phone }),
        signal: requestSignal,
        timeoutMessage: "استغرق Evolution وقتًا أطول من المتوقع. حاول مرة أخرى."
      });
      if (payload.type === "connected" || payload.status === "connected") {
        state.linkedDevice = { ...state.linkedDevice, status: "connected", pairingError: "", pairingCode: "", qrActive: false, qrBase64: "" };
        toast(payload.message || "الجهاز متصل بالفعل.", "success");
        return;
      }
      if (!payload.pairingCode) throw new Error("لم يرجع Evolution رمز اقتران لهذه المحاولة. حاول مرة أخرى أو استخدم الباركود.");
      state.linkedDevice = { ...state.linkedDevice, status: "pending_pairing", linkMethod: "pairing", pairingSupported: true, phoneNumber: `+${phone}`, pairingCode: payload.pairingCode, pairingError: "", pairingExpiresAt: new Date(Date.now() + (payload.expiresIn || 60) * 1000).toLocaleTimeString("ar-SA"), activity: ["تم إنشاء رمز الاقتران عبر Evolution API", ...(state.linkedDevice.activity || []).slice(0, 4)] };
      toast("تم إنشاء رمز الاقتران");
    } catch (error) {
      const message = error.message || "تعذر إنشاء رمز الاقتران، حاول استخدام الباركود.";
      if (error.code === "INSTANCE_ALREADY_CONNECTED") {
        state.linkedDevice = { ...state.linkedDevice, status: "connected", pairingError: "", pairingCode: "", qrActive: false, qrBase64: "" };
        toast(message, "success");
        return;
      }
      state.linkedDevice = { ...state.linkedDevice, pairingSupported: error.status === 501 ? false : state.linkedDevice.pairingSupported, pairingError: message, pairingCode: "" };
      toast(message, "danger");
    } finally {
      state.linkedDevice.pairingLoading = false;
      render();
    }
  }
  if (action === "create-device-qr") {
    state.linkedDevice = { ...state.linkedDevice, qrLoading: true, qrImageLoaded: false, qrError: "", qrBase64: "", qrActive: false };
    render();
    const requestSignal = AbortSignal.timeout(20_000);
    try {
      const instance = await ensureEvolutionInstance({ signal: requestSignal, timeoutMessage: "استغرق Evolution وقتًا أطول من المتوقع. حاول مرة أخرى." });
      if (!instance?.id) throw new Error("تعذر إنشاء جلسة Evolution API.");
      state.linkedDevice = { ...state.linkedDevice, ...instance, instanceId: instance.id, instanceName: instance.instanceName || "", qrBase64: "" };
      const payload = await fetchJson(`/api/whatsapp/instances/${instance.id}/qr`, { signal: requestSignal, timeoutMessage: "استغرق Evolution وقتًا أطول من المتوقع. حاول مرة أخرى." });
      if (payload.type === "connected" || payload.status === "connected") {
        state.linkedDevice = { ...state.linkedDevice, status: "connected", qrActive: false, qrImageLoaded: false, qrError: "", qrBase64: "" };
        toast(payload.message || "الجهاز متصل بالفعل.", "success");
        return;
      }
      const qrDataUri = payload.qrDataUri || payload.qrBase64;
      if (!isRealQrDataUri(qrDataUri)) throw new Error("لم يرجع Evolution باركود صالح لهذه المحاولة.");
      state.linkedDevice = { ...state.linkedDevice, status: "pending_qr", linkMethod: "qr", qrActive: true, qrImageLoaded: false, qrError: "", qrBase64: qrDataUri, qrExpiresAt: new Date(Date.now() + (payload.expiresIn || 60) * 1000).toLocaleTimeString("ar-SA"), activity: ["تم إنشاء جلسة Evolution API", "تم تجهيز QR مؤقت", ...(state.linkedDevice.activity || []).slice(0, 3)] };
      toast("تم إنشاء باركود جديد عبر Evolution API");
      closePortal();
    } catch (error) {
      const message = error.message || "تعذر إنشاء الباركود من Evolution API. يرجى المحاولة مرة أخرى.";
      state.linkedDevice = { ...state.linkedDevice, status: "error", qrActive: false, qrImageLoaded: false, qrBase64: "", qrError: message };
      toast(message, "danger");
    } finally {
      state.linkedDevice.qrLoading = false;
      render();
    }
  }
  if (action === "show-device-qr") {
    const hasRealQr = isRealQrDataUri(state.linkedDevice.qrBase64);
    const realQr = hasRealQr ? `<img class="qr-real" src="${state.linkedDevice.qrBase64}" alt="باركود ربط واتساب">` : `<div class="qr-empty"><strong>لا يوجد باركود صالح</strong><p class="muted">${escapeHtml(state.linkedDevice.qrError || "اضغط إنشاء باركود جديد.")}</p></div>`;
    openModal("باركود ربط واتساب", `<div class="qr-box ${hasRealQr ? "active" : ""} modal-qr">${realQr}<strong>${hasRealQr ? "امسح الباركود من واتساب" : "لا يوجد باركود جاهز للمسح"}</strong><p class="muted">تتم عملية الربط من الخادم ولا يتم كشف EVOLUTION_API_KEY.</p></div>`, `<button class="btn btn-primary" data-action="create-device-qr">إنشاء باركود جديد</button><button class="btn btn-secondary" data-action="close-modal">إغلاق</button>`);
  }
  if (action === "copy-pairing") state.linkedDevice.pairingCode ? copyText(state.linkedDevice.pairingCode, "تم نسخ رمز الاقتران") : toast("لا يوجد رمز اقتران صادر من Evolution API", "warning");
  if (action === "check-device-connection") {
    if (!["pending_qr", "pending_pairing", "connected"].includes(state.linkedDevice.status)) return toast("أنشئ جلسة ربط أولا", "warning");
    try {
      const payload = await fetchJson(`/api/whatsapp/instances/${state.linkedDevice.instanceId}/check`, { method: "POST", signal: AbortSignal.timeout(15_000), timeoutMessage: "استغرق فحص الاتصال وقتًا أطول من المتوقع." });
      state.linkedDevice = { ...state.linkedDevice, status: payload.status, phoneNumber: payload.phoneNumber || state.linkedDevice.phoneNumber, qrActive: payload.status !== "connected", qrImageLoaded: payload.status === "connected" ? false : state.linkedDevice.qrImageLoaded, qrBase64: payload.status === "connected" ? "" : state.linkedDevice.qrBase64, lastActivity: "الآن", lastCheckAt: "الآن", activity: [payload.status === "connected" ? "تم فحص الاتصال بنجاح" : "لا يزال الربط بانتظار واتساب", ...(state.linkedDevice.activity || []).slice(0, 4)] };
      toast(payload.status === "connected" ? "الاتصال يعمل بنجاح" : "لم يكتمل الربط بعد", payload.status === "connected" ? "success" : "warning");
      render();
    } catch (error) {
      toast(error.message || "تعذر فحص الاتصال", "danger");
    }
  }
  if (action === "send-device-test") {
    if (state.linkedDevice.status !== "connected") return toast("لا يمكن الإرسال قبل ربط الجهاز", "danger");
    return openModal("إرسال رسالة اختبار", `<form data-submit="send-device-test" class="grid"><label class="field"><span>رقم المستلم التجريبي</span><input class="input" name="to" inputmode="numeric" placeholder="9665XXXXXXXX" required></label><label class="field"><span>الرسالة</span><textarea class="textarea" name="message" required>مرحبًا {{name}}، هذه رسالة اختبار من RenewPilot AI. أرسل إيقاف لإلغاء الرسائل.</textarea></label><button class="btn btn-primary" type="submit">إرسال الاختبار</button></form>`);
  }
  if (action === "disconnect-device") {
    try {
      await fetchJson(`/api/whatsapp/instances/${state.linkedDevice.instanceId}/disconnect`, { method: "POST" });
      state.linkedDevice = { ...state.linkedDevice, status: "disconnected", qrActive: false, qrImageLoaded: false, qrBase64: "", activity: ["تم فصل الجهاز", ...(state.linkedDevice.activity || []).slice(0, 4)] };
      toast("تم فصل الجهاز");
      render();
    } catch (error) {
      toast(error.message || "تعذر فصل الجهاز", "danger");
    }
  }
  if (action === "delete-device") {
    try {
      await fetchJson(`/api/whatsapp/instances/${state.linkedDevice.instanceId}`, { method: "DELETE" });
      state.linkedDevice = { ...defaultLinkedDevice };
      toast("تم حذف الجهاز المرتبط");
      render();
    } catch (error) {
      toast(error.message || "تعذر حذف الجهاز", "danger");
    }
  }
  if (action === "notifications") toast((state.dashboardOverview?.recentNotifications || []).length ? "تم فتح أحدث التنبيهات المسجلة" : "لا توجد تنبيهات جديدة", "info");
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
  if (action === "mark-renewed") openModal(state.language === "ar" ? "تم التجديد" : "Mark as renewed", `<form data-submit="quick-renew" data-id="${target.dataset.id}" class="grid"><label class="field"><span>${state.language === "ar" ? "مدة التجديد" : "Renewal duration"}</span><select class="select" name="duration"><option value="month">${state.language === "ar" ? "شهر" : "One month"}</option><option value="three_months">${state.language === "ar" ? "3 أشهر" : "3 months"}</option><option value="six_months">${state.language === "ar" ? "6 أشهر" : "6 months"}</option><option value="year">${state.language === "ar" ? "سنة" : "One year"}</option><option value="custom">${state.language === "ar" ? "تاريخ مخصص" : "Custom date"}</option></select></label><label class="field"><span>${state.language === "ar" ? "التاريخ المخصص" : "Custom date"}</span><input class="input" type="date" name="customDate"></label><label class="check-row"><input type="checkbox" name="sendNotification" value="true"><span>إرسال إشعار بعد التجديد (اختياري)</span></label><button class="btn btn-primary">${t("common.confirm")}</button><button type="button" class="btn btn-secondary" data-action="close-modal">${t("common.cancel")}</button></form>`);
  if (action === "run-readiness") { state.readiness = null; syncRouteData(true); render(); }
  if (action === "reload-issues") { state.operationalIssues = null; syncRouteData(true); render(); }
  if (action === "reload-subscriptions") { state.dbSubscriptions = null; syncRouteData(true); render(); }
  if (action === "send-subscription-reminder") {
    try {
      await fetchJson(`/api/subscriptions/${target.dataset.id}/remind`, { method: "POST" });
      toast("تمت إضافة التذكير إلى قائمة الإرسال");
    } catch (error) { toast(error.message || "تعذر إرسال التذكير", "danger"); }
  }
  if (action === "subscription-notifications") {
    try {
      const payload = await fetchJson(`/api/subscriptions/${target.dataset.id}/notifications`);
      const content = payload.items.length ? payload.items.map((item) => `<div class="activity-item"><div><strong>${escapeHtml(item.status)} · ${escapeHtml(item.channel)}</strong><p class="muted">${escapeHtml(item.createdAt)} ${item.errorMessage ? `· ${escapeHtml(item.errorMessage)}` : ""}</p></div></div>`).join("") : `<p class="muted">لا توجد تنبيهات لهذا الاشتراك</p>`;
      openDrawer("سجل التنبيهات", `<div class="activity-list">${content}</div>`);
    } catch (error) { toast(error.message, "danger"); }
  }
  if (action === "edit-customer-phone") openModal("تعديل رقم واتساب", `<form data-submit="edit-customer-phone" data-id="${target.dataset.customerId}" class="grid"><label class="field"><span>رقم واتساب بصيغة دولية</span><input class="input" name="phoneNumber" value="${escapeHtml(target.dataset.phone || "")}" placeholder="9665XXXXXXXX" required></label><button class="btn btn-primary">حفظ الرقم</button></form>`);
  if (action === "toggle-customer-reminders") {
    try {
      await fetchJson(`/api/customers/${target.dataset.customerId}/reminders`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paused: target.dataset.paused !== "true" }) });
      state.dbSubscriptions = null; syncRouteData(true); toast("تم تحديث حالة التذكيرات");
    } catch (error) { toast(error.message, "danger"); }
  }
  if (action === "customer-timeline") {
    try {
      const payload = await fetchJson(`/api/customers/${target.dataset.customerId}/timeline`);
      const content = payload.items.length ? payload.items.map((item) => `<div class="timeline-item"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.createdAt)}</small></div>`).join("") : `<p class="muted">لا يوجد نشاط مسجل</p>`;
      openDrawer("Timeline العميل", `<div class="timeline">${content}</div>`);
    } catch (error) { toast(error.message, "danger"); }
  }
  if (action === "add-unsubscribe") openModal(t("sidebar.unsubscribe"), `<form data-submit="unsubscribe" class="grid">${field(state.language === "ar" ? "رقم واتساب" : "WhatsApp number", "phoneNumber", "tel")}${field(state.language === "ar" ? "السبب" : "Reason", "reason")}<button class="btn btn-primary">${t("common.save")}</button></form>`);
  if (action === "import-save") {
    const text = state.importText || "";
    try {
      const payload = await fetchJson("/api/subscriptions/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      closePortal();
      state.dbSubscriptions = null;
      state.dbCustomers = null;
      state.dashboardOverview = null;
      await syncRouteData(true);
      toast(`${state.language === "ar" ? "تم استيراد" : "Imported"} ${payload.saved || 0}`);
    } catch (error) { toast(error.message || t("common.serverError"), "danger"); }
  }
  if (action === "add-customer") openModal("إضافة عميل", customerForm());
  if (action === "import-customers") openModal("استيراد العملاء", `<form data-submit="customer-import" class="grid"><label class="field"><span>ألصق CSV: الاسم، البريد، الهاتف</span><textarea class="textarea spreadsheet-input" name="text" required placeholder="الاسم,البريد,الهاتف"></textarea></label><button class="btn btn-primary">استيراد</button></form>`);
  if (action === "columns") toast("تم تثبيت أعمدة الجدول الحالية");
  if (action === "apply-filter") toast("تم تطبيق الفلترة");
  if (action === "export-subscriptions") {
    const rows = Array.isArray(state.dbSubscriptions) ? state.dbSubscriptions : [];
    if (!rows.length) return toast("لا توجد بيانات لتصديرها", "warning");
    exportCsv("subscriptions.csv", [["رقم الطلب", "العميل", "الخدمة", "الباقة", "البداية", "النهاية", "الحالة"], ...rows.map((r) => [r.orderNumber, r.customerName, r.serviceName, r.planName, String(r.startDate).slice(0, 10), String(r.endDate).slice(0, 10), r.status])]);
  }
  if (action === "export-customers") {
    const rows = Array.isArray(state.dbCustomers) ? state.dbCustomers : [];
    if (!rows.length) return toast("لا توجد بيانات لتصديرها", "warning");
    exportCsv("customers.csv", [["الاسم", "البريد", "الهاتف", "الحالة", "عدد الاشتراكات"], ...rows.map((r) => [r.name, r.email || "", r.phone || "", r.status, r.subscriptionCount || 0])]);
  }
  if (action === "export-report") {
    const stats = overviewStats();
    exportCsv("renewpilot-report.csv", [["المؤشر", "القيمة"], ["الإيراد الشهري", stats.monthlyRevenue], ["الرسائل المرسلة", stats.sentMessages], ["نسبة النجاح", `${stats.successRate}%`], ["العملاء المتجددون", stats.renewedCustomers]]);
  }
  if (action === "copy-renewal") copyText(target.dataset.linkValue);
  if (action === "renew-now") openModal("تأكيد التجديد", `<p>هل تريد فتح عملية التجديد الآن؟</p>`, `<button class="btn btn-primary" data-action="confirm-renew">تجديد الآن</button><button class="btn btn-secondary" data-action="close-modal">إلغاء</button>`);
  if (action === "confirm-renew") { closePortal(); toast("تم تجهيز رابط التجديد"); }
  if (action === "subscription-edit-db") {
    const row = (state.dbSubscriptions || []).find((item) => item.id === target.dataset.id);
    if (row) openModal("تعديل الاشتراك", subscriptionForm(row, row.id));
  }
  if (action === "subscription-delete-db") {
    if (!confirm("هل تريد حذف هذا الاشتراك؟")) return;
    try {
      await fetchJson(`/api/subscriptions/${target.dataset.id}`, { method: "DELETE" });
      state.dbSubscriptions = null; state.dashboardOverview = null;
      await syncRouteData(true); toast("تم حذف الاشتراك");
    } catch (error) { toast(error.message || "تعذر حذف الاشتراك", "danger"); }
  }
  if (action === "customer-details-db") {
    const row = (state.dbCustomers || []).find((item) => item.id === target.dataset.id);
    if (row) openDrawer("تفاصيل العميل", `<div class="customer-detail"><h3>${escapeHtml(row.name)}</h3><p>${escapeHtml(row.email || "لا يوجد بريد")}</p><p>${escapeHtml(row.phone || "لا يوجد رقم")}</p><div class="grid grid-2"><div class="mini-stat"><span>الاشتراكات</span><strong>${row.subscriptionCount || 0}</strong></div><div class="mini-stat"><span>القيمة</span><strong>${formatMoney(row.totalValue || 0)}</strong></div></div><button class="btn btn-secondary" data-action="customer-timeline" data-customer-id="${row.id}">عرض Timeline</button></div>`);
  }
  if (action === "customer-edit-db") {
    const row = (state.dbCustomers || []).find((item) => item.id === target.dataset.id);
    if (row) openModal("تعديل عميل", customerForm(row, row.id));
  }
  if (action === "customer-delete-db") {
    if (!confirm("هل تريد حذف هذا العميل؟")) return;
    try {
      await fetchJson(`/api/customers/${target.dataset.id}`, { method: "DELETE" });
      state.dbCustomers = null; state.dbSubscriptions = null; state.dashboardOverview = null;
      await syncRouteData(true); toast("تم حذف العميل");
    } catch (error) { toast(error.message || "تعذر حذف العميل", "danger"); }
  }
  if (action === "send-message") {
    if (!overviewStats().connectedDevices) return toast("اربط جهازًا أولًا حتى تتمكن من إرسال التنبيهات.", "warning");
    await navigate("/dashboard/devices");
    toast("استخدم زر إرسال رسالة اختبار من الجهاز المتصل.", "info");
  }
  if (action === "import-unsubscribes") openModal("استيراد قائمة الإيقاف", `<form data-submit="unsubscribe-import" class="grid"><label class="field"><span>رقم في كل سطر</span><textarea class="textarea spreadsheet-input" name="text" required placeholder="9665XXXXXXXX"></textarea></label><button class="btn btn-primary">استيراد القائمة</button></form>`);
  if (action === "policy-details" || action === "review-risks") {
    const health = state.whatsappHealth?.health;
    openDrawer("سياسة الإرسال الآمن", health ? `<div class="grid"><div class="risk-summary"><strong>${Number(health.risk || 0)}</strong><span>/100</span></div><p>${escapeHtml(health.advice || "")}</p><p class="muted">عدد قواعد الإرسال النشطة: ${overviewStats().safeRules}</p></div>` : emptyState("لا توجد نتيجة فحص بعد", "اربط جهازًا أولًا لعرض تفاصيل السياسة."));
  }
  if (action === "set-language") { state.language = target.dataset.value === "en" ? "en" : "ar"; localStorage.setItem("renewpilot_locale", state.language); applyPreferences(); render(); }
  if (action === "set-theme") { state.theme = target.dataset.value === "dark" ? "dark" : "light"; localStorage.setItem("renewpilot_theme", state.theme); applyPreferences(); render(); }
  if (action === "save-settings") await saveAccountSettings();
  if (action === "change-password") openModal("تغيير كلمة المرور", `<form data-submit="password" class="grid">${field("كلمة المرور الحالية", "old", "password")}${field("كلمة المرور الجديدة", "new", "password")}<button class="btn btn-primary">حفظ</button></form>`);
  if (action === "manage-sessions") openDrawer("إدارة الجلسات", `<div class="session-list"><div class="setting-row"><div><strong>الجلسة الحالية</strong><p class="muted">${escapeHtml(state.dashboardOverview?.profile?.email || "")}</p></div><span class="status success">نشطة</span></div><button class="btn btn-danger" data-action="logout-confirm">تسجيل الخروج من الجلسة</button></div>`);
  if (action === "remove-unsubscribe") {
    try { await fetchJson(`/api/unsubscribes?id=${encodeURIComponent(target.dataset.id)}`, { method: "DELETE" }); state.unsubscribes = null; state.dashboardOverview = null; await syncRouteData(true); toast("تم حذف الرقم"); }
    catch (error) { toast(error.message || "تعذر حذف الرقم", "danger"); }
  }
  if (action === "export-unsubscribes") {
    const rows = Array.isArray(state.unsubscribes) ? state.unsubscribes : [];
    if (!rows.length) return toast("لا توجد بيانات لتصديرها", "warning");
    exportCsv("unsubscribe-list.csv", [["الرقم", "السبب", "التاريخ"], ...rows.map((row) => [row.phoneNumber, row.reason || "", row.unsubscribedAt || ""])]);
  }
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
      const payload = await fetchJson(`/api/whatsapp/instances/${state.linkedDevice.instanceId}/send-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(60_000),
        timeoutMessage: "تم إرسال الطلب إلى واتساب، جارٍ التحقق من حالة الإرسال."
      });
      if (payload.status === "pending_verification") {
        closePortal();
        toast(payload.message || "تم إرسال الطلب إلى واتساب، جارٍ التحقق من حالة الإرسال.", "warning");
        render();
        return;
      }
      state.linkedDevice.messagesToday = (state.linkedDevice.messagesToday || 0) + 1;
      state.linkedDevice.messagesMonth = (state.linkedDevice.messagesMonth || 0) + 1;
      state.linkedDevice.lastSendAt = "الآن";
      state.linkedDevice.activity = ["تم إرسال رسالة اختبار بنجاح", ...(state.linkedDevice.activity || []).slice(0, 4)];
      closePortal();
      toast(payload.message || "تم إرسال رسالة الاختبار بنجاح.");
      render();
    } catch (error) {
      if (button) { button.disabled = false; button.textContent = "إرسال الاختبار"; }
      toast(error.message || "تعذر إرسال رسالة الاختبار. تحقق من اتصال واتساب.", error.code === "EVOLUTION_TIMEOUT" ? "warning" : "danger");
    }
    return;
  }
  if (type === "login") {
    if (!data.email) return toast(t("auth.emailRequired"), "danger");
    if (!data.password) return toast(t("auth.passwordRequired"), "danger");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return toast(t("auth.invalidEmail"), "danger");
    const button = form.querySelector("button[type='submit'], button:not([type])");
    if (button) { button.disabled = true; button.textContent = t("common.loading"); }
    let loginAccepted = false;
    try {
      const response = await fetch("/api/auth/login", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const payload = await response.json().catch(() => null);
      loginAccepted = response.ok && payload?.ok === true && Boolean(payload.user?.id);
    } catch {
      loginAccepted = false;
    }
    if (!loginAccepted) { if (button) { button.disabled = false; button.textContent = t("auth.login"); } return toast(t("auth.invalidCredentials"), "danger"); }
    if (!await enterDashboardAfterSessionVerification()) { if (button) { button.disabled = false; button.textContent = t("auth.login"); } return toast("تعذر إنشاء الجلسة.", "danger"); }
    toast(t("auth.loginSuccess"));
    return;
  }
  if (type === "register") {
    if (!data.name || data.name.trim().length < 3) return toast(state.language === "ar" ? "يرجى إدخال الاسم الكامل." : "Please enter your full name.", "danger");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || "")) return toast(t("auth.invalidEmail"), "danger");
    if (!/^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(data.password || "")) return toast(t("auth.passwordMin"), "danger");
    if (data.password !== data.confirmPassword) return toast(t("auth.passwordMismatch"), "danger");
    try {
      const response = await fetch("/api/auth/register", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const messages = state.language === "ar" ? {
          email_exists: "البريد الإلكتروني مستخدم مسبقًا.",
          invalid_email: "صيغة البريد الإلكتروني غير صحيحة.",
          weak_password: "كلمة المرور لا تحقق شروط الأمان.",
          database_unavailable: "تعذر الاتصال بقاعدة البيانات، حاول لاحقًا.",
          database_schema_missing: "تعذر إنشاء مساحة العمل، حاول لاحقًا."
        } : {
          email_exists: "This email is already in use.",
          invalid_email: "The email address is invalid.",
          weak_password: "The password does not meet the security requirements.",
          database_unavailable: "The database is currently unavailable. Please try again later.",
          database_schema_missing: "The workspace could not be created. Please try again later."
        };
        return toast(messages[payload?.reason] || t("common.serverError"), "danger");
      }
      if (!payload?.ok || !payload.user?.id || !await enterDashboardAfterSessionVerification()) {
        return toast(state.language === "ar" ? "تعذر إنشاء الجلسة، حاول تسجيل الدخول." : "The session could not be created. Please sign in.", "danger");
      }
    } catch {
      return toast(t("common.serverError"), "danger");
    }
    toast(t("auth.registerSuccess"));
    return;
  }
  if (type === "subscription") {
    const id = form.dataset.id;
    try {
      await fetchJson(id ? `/api/subscriptions/${id}` : "/api/subscriptions", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, customerId: data.customerId || form.querySelector("[name='customerId']")?.value, price: Number(data.price || 0) })
      });
      closePortal();
      state.dbSubscriptions = null; state.dashboardOverview = null;
      await syncRouteData(true);
      toast(id ? "تم تحديث الاشتراك بنجاح" : "تمت إضافة الاشتراك بنجاح");
    } catch (error) { toast(error.message || "تعذر حفظ الاشتراك", "danger"); }
    return;
  }
  if (type === "customer") {
    const id = form.dataset.id;
    const tags = String(data.tags || "").split(/[،,]/).map((item) => item.trim()).filter(Boolean);
    try {
      await fetchJson(id ? `/api/customers/${id}` : "/api/customers", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, tags })
      });
      closePortal();
      state.dbCustomers = null; state.dbSubscriptions = null; state.dashboardOverview = null;
      await syncRouteData(true);
      toast(id ? "تم تحديث العميل بنجاح" : "تمت إضافة العميل بنجاح");
    } catch (error) { toast(error.message || "تعذر حفظ العميل", "danger"); }
    return;
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
    try {
      await fetchJson(`/api/subscriptions/${form.dataset.id}/renew`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ duration: data.duration, customDate: data.customDate || null }) });
      closePortal();
      state.dbSubscriptions = null;
      syncRouteData(true);
      toast(state.language === "ar" ? "تم تمديد الاشتراك وتسجيل العملية دون إرسال تلقائي." : "Subscription renewed without automatic sending.");
      if (data.sendNotification === "true") toast("تم التجديد. استخدم زر إرسال تذكير بعد التأكد من اتصال واتساب.", "warning");
    } catch (error) { toast(error.message || t("common.serverError"), "danger"); }
    return;
  }
  if (type === "edit-customer-phone") {
    try {
      await fetchJson(`/api/customers/${form.dataset.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phoneNumber: data.phoneNumber }) });
      closePortal();
      state.dbSubscriptions = null;
      syncRouteData(true);
      toast("تم تحديث رقم واتساب");
    } catch (error) { toast(error.message || "تعذر تحديث الرقم", "danger"); }
    return;
  }
  if (type === "unsubscribe") {
    try {
      await fetchJson("/api/unsubscribes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      closePortal(); state.unsubscribes = null; state.dashboardOverview = null; await syncRouteData(true);
      toast(state.language === "ar" ? "تمت إضافة الرقم إلى قائمة الإيقاف." : "The number was added to the unsubscribe list.");
    } catch (error) { toast(error.message || "تعذر إضافة الرقم", "danger"); }
    return;
  }
  if (type === "unsubscribe-import") {
    const numbers = String(data.text || "").split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    if (!numbers.length) return toast("لا توجد أرقام للاستيراد", "warning");
    let saved = 0;
    for (const phoneNumber of numbers) {
      try {
        await fetchJson("/api/unsubscribes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phoneNumber, reason: "استيراد يدوي" }) });
        saved += 1;
      } catch {}
    }
    closePortal(); state.unsubscribes = null; state.dashboardOverview = null; await syncRouteData(true);
    toast(`تم استيراد ${saved} رقم`);
    return;
  }
  if (type === "password") {
    const password = data.new || "";
    if (!/^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password)) return toast("كلمة المرور يجب أن تكون 8 أحرف على الأقل وتحتوي على حرف ورقم ورمز خاص.", "danger");
    try {
      await fetchJson("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: data.old, newPassword: data.new }) });
      closePortal(); toast("تم تغيير كلمة المرور بنجاح.");
    } catch (error) { toast(error.message || "تعذر تغيير كلمة المرور", "danger"); }
    return;
  }
  if (type === "profile-settings") {
    await saveAccountSettings({ name: data.name });
    return;
  }
  if (type === "customer-import") {
    const lines = String(data.text || "").trim().split(/\r?\n/).filter(Boolean);
    const rows = lines.slice(1).map((line) => {
      const [name, email, phone] = line.split(",").map((value) => value?.trim());
      return { name, email, phone };
    }).filter((row) => row.name);
    if (!rows.length) return toast("لا توجد صفوف صالحة للاستيراد", "warning");
    let saved = 0;
    for (const row of rows) {
      try {
        await fetchJson("/api/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(row) });
        saved += 1;
      } catch {}
    }
    closePortal(); state.dbCustomers = null; state.dashboardOverview = null; await syncRouteData(true);
    toast(`تم استيراد ${saved} عميل`);
    return;
  }
  if (["demo", "ticket", "chat", "message", "template", "ai-question"].includes(type)) {
    closePortal();
    toast(type === "ai-question" ? "تم استلام سؤالك، سيتم ربط المساعد الذكي لاحقًا." : "تم حفظ البيانات بنجاح");
  }
}

function render() {
  applyPreferences();
  const requestedRoute = location.pathname;
  const normalizedRoute = dashboardAliases[requestedRoute] || requestedRoute;
  if (normalizedRoute !== requestedRoute) history.replaceState({}, "", normalizedRoute + location.search);
  state.route = normalizedRoute;
  state.query = new URLSearchParams(location.search);
  if (state.route.startsWith("/dashboard")) {
    const pages = {
      "/dashboard": dashboardHome,
      "/dashboard/subscriptions": subscriptionsPage,
      "/dashboard/customers": customersPage,
      "/dashboard/devices": connectedDevicesCenterPage,
      "/dashboard/security": securityPage,
      "/dashboard/reports": reportsPage,
      "/dashboard/settings": settingsPage
    };
    app.innerHTML = (pages[state.route] || dashboardHome)();
    localizeElement(app);
    bindQrImageState();
    syncRouteData();
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

function bindQrImageState() {
  const images = [...app.querySelectorAll("img.qr-real")];
  if (!images.length) return;

  const markFailed = () => {
    if (!state.linkedDevice.qrBase64) return;
    const message = "تعذر عرض الباركود في المتصفح. يرجى إعادة إنشاء الباركود.";
    state.linkedDevice = { ...state.linkedDevice, status: "error", qrActive: false, qrImageLoaded: false, qrBase64: "", qrError: message };
    toast(message, "danger");
    render();
  };
  const markLoaded = () => {
    if (!images.every((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0)) return;
    if (state.linkedDevice.qrImageLoaded) return;
    state.linkedDevice = { ...state.linkedDevice, qrImageLoaded: true };
    render();
  };

  images.forEach((image) => {
    image.addEventListener("load", markLoaded, { once: true });
    image.addEventListener("error", markFailed, { once: true });
  });
  markLoaded();
  requestAnimationFrame(markLoaded);
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
  }
});

document.addEventListener("change", (event) => {
  const target = event.target;
  if (target.dataset.action === "dashboard-filter") {
    state.filter = target.value;
    render();
  }
  if (target.dataset.action === "report-period") {
    state.reportPeriod = target.value;
    render();
  }
  if (target.dataset.action === "setting-toggle") {
    state.settings[target.dataset.key] = target.checked;
    void saveAccountSettings();
  }
});

window.addEventListener("popstate", render);
render();
if (state.route === "/dashboard/devices") void syncLinkedDevice();
