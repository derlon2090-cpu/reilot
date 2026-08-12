const GOOGLE_SCRIPT_URL = "https://accounts.google.com/gsi/client";
const KNOWN_ACCOUNT_KEY = "renvix.auth.known-account.v1";
let scriptPromise;

function config() {
  return window.__RENVIX_CONFIG__ || {};
}

function authApiBaseUrl() {
  const configured = String(config().authApiUrl || "").trim();
  if (configured) {
    try { return new URL(configured).origin; } catch { return ""; }
  }
  return /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname) ? window.location.origin : "";
}

function authApiUrl(path) {
  const baseUrl = authApiBaseUrl();
  if (!baseUrl) throw new Error("auth_backend_required");
  return new URL(path, baseUrl).toString();
}

function languageFor(element) {
  return element?.closest?.("[data-auth-language]")?.dataset.authLanguage === "en" ? "en" : "ar";
}

function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src^="${GOOGLE_SCRIPT_URL}"]`);
    const script = existing || document.createElement("script");
    const done = () => window.google?.accounts?.id ? resolve(window.google) : reject(new Error("google_library_unavailable"));
    script.addEventListener("load", done, { once: true });
    script.addEventListener("error", () => reject(new Error("google_library_unavailable")), { once: true });
    if (!existing) {
      script.src = GOOGLE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  }).catch((error) => {
    document.querySelector(`script[src^="${GOOGLE_SCRIPT_URL}"]`)?.remove();
    scriptPromise = undefined;
    throw error;
  });
  return scriptPromise;
}

function activateRecovery(host, english, reason = "") {
  const button = host.querySelector(".auth-google-placeholder");
  if (reason) host.dataset.googleSdkStatus = reason;
  if (!button || button.dataset.googleRetry === "true") return;
  button.disabled = false;
  button.dataset.googleRetry = "true";
  button.querySelector("span")?.replaceChildren(english ? "Retry Google" : "إعادة محاولة Google");
  button.addEventListener("click", () => {
    button.disabled = true;
    delete host.dataset.googleMounted;
    delete host.dataset.googleSdkStatus;
    scriptPromise = undefined;
    document.querySelector(`script[src^="${GOOGLE_SCRIPT_URL}"]`)?.remove();
    setGoogleStatus(host, english ? "Retrying Google securely…" : "جارٍ إعادة تحميل Google بأمان…", "info");
    void mountGoogleButton(host);
  }, { once: true });

  const area = host.closest(".auth-google-area");
  if (!area || area.querySelector("[data-google-server-fallback]") || !authApiBaseUrl()) return;
  const fallback = document.createElement("button");
  fallback.type = "button";
  fallback.className = "auth-google-server-fallback";
  fallback.dataset.googleServerFallback = "true";
  fallback.textContent = english ? "Continue on Google's secure page" : "المتابعة عبر صفحة Google الآمنة";
  fallback.addEventListener("click", () => {
    fallback.disabled = true;
    const target = new URL("/api/auth/google/start", authApiBaseUrl());
    target.searchParams.set("locale", english ? "en" : "ar");
    window.location.assign(target.toString());
  }, { once: true });
  area.append(fallback);
}

function readKnownAccount() {
  try {
    const value = JSON.parse(localStorage.getItem(KNOWN_ACCOUNT_KEY) || "null");
    if (!value || !/^\S+@\S+\.\S+$/.test(String(value.email || ""))) return null;
    return { email: String(value.email).slice(0, 254), name: String(value.name || "").slice(0, 160), image: /^https:\/\//i.test(String(value.image || "")) ? String(value.image).slice(0, 1000) : "" };
  } catch {
    return null;
  }
}

function initials(account) {
  return (account.name || account.email).trim().slice(0, 1).toUpperCase();
}

function renderKnownAccount(root) {
  const host = root.querySelector("[data-known-account]");
  if (!host) return;
  const english = languageFor(host) === "en";
  const account = readKnownAccount();
  host.replaceChildren();
  host.hidden = !account;
  if (!account) return;
  const card = document.createElement("button");
  card.type = "button";
  card.className = "auth-known-account-card";
  card.dataset.action = "use-known-account";
  const avatar = document.createElement("span");
  avatar.className = "auth-known-account-avatar";
  if (account.image) {
    const image = document.createElement("img");
    image.src = account.image;
    image.alt = "";
    image.referrerPolicy = "no-referrer";
    avatar.append(image);
  } else avatar.textContent = initials(account);
  const copy = document.createElement("span");
  copy.className = "auth-known-account-copy";
  const name = document.createElement("strong");
  name.textContent = account.name || (english ? "Saved account" : "حساب محفوظ");
  const email = document.createElement("small");
  email.textContent = account.email;
  copy.append(name, email);
  const check = document.createElement("span");
  check.className = "auth-known-account-check";
  check.textContent = "✓";
  card.append(avatar, copy, check);
  const another = document.createElement("button");
  another.type = "button";
  another.className = "auth-known-account-another";
  another.dataset.action = "use-another-account";
  another.innerHTML = `<span aria-hidden="true">＋</span>${english ? "Use another account" : "إضافة حساب آخر"}`;
  host.append(card, another);
  card.addEventListener("click", () => {
    const form = host.closest("article")?.querySelector('form[data-submit="login"]');
    const emailInput = form?.elements?.email;
    if (!emailInput) return;
    emailInput.value = account.email;
    emailInput.dispatchEvent(new Event("input", { bubbles: true }));
    form.elements.password?.focus();
  });
  another.addEventListener("click", () => {
    const form = host.closest("article")?.querySelector('form[data-submit="login"]');
    if (!form?.elements?.email) return;
    form.elements.email.value = "";
    form.elements.password.value = "";
    form.elements.email.focus();
  });
}

async function requestNonce() {
  const response = await fetch(authApiUrl("/api/auth/google/nonce"), { credentials: "include", cache: "no-store", mode: "cors" });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.nonce) throw new Error(payload?.reason || "google_nonce_unavailable");
  return payload.nonce;
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function assertBackendClientId(clientId) {
  const response = await fetch(authApiUrl("/api/auth/google/config"), { credentials: "include", cache: "no-store", mode: "cors" });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.clientIdFingerprint) throw new Error(payload?.reason || "google_backend_unavailable");
  if (payload.clientIdFingerprint !== await sha256Hex(clientId)) throw new Error("google_client_mismatch");
}

function setGoogleStatus(host, message = "", tone = "error") {
  const status = host.parentElement?.querySelector("[data-auth-google-status]");
  if (!status) return;
  status.hidden = !message;
  status.dataset.tone = tone;
  status.textContent = message;
}

async function submitCredential(host, credential) {
  const english = languageFor(host) === "en";
  host.closest(".auth-google-area")?.classList.add("is-busy");
  setGoogleStatus(host, english ? "Signing in securely…" : "جارٍ تسجيل الدخول بأمان…", "info");
  try {
    const response = await fetch(authApiUrl("/api/auth/google"), {
      method: "POST",
      credentials: "include",
      mode: "cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential, locale: english ? "en" : "ar" })
    });
    const payload = await response.json().catch(() => null);
    window.dispatchEvent(new CustomEvent("renvix:google-auth-result", { detail: { responseOk: response.ok, status: response.status, payload } }));
    if (!response.ok) throw new Error(payload?.reason || "google_auth_failed");
    setGoogleStatus(host, "", "info");
  } catch (error) {
    const messages = {
      account_link_verification_required: english ? "Verify ownership of the existing account before linking Google." : "يلزم التحقق من ملكية الحساب الحالي قبل ربط Google.",
      rate_limited: english ? "Too many attempts. Please wait and try again." : "محاولات كثيرة. انتظر قليلًا ثم حاول مجددًا.",
      google_not_configured: english ? "Google sign-in is not configured yet." : "إعداد تسجيل Google غير مكتمل بعد."
      ,auth_backend_required: english ? "The secure authentication backend is not connected." : "خادم المصادقة الآمن غير مربوط بعد."
      ,google_client_mismatch: english ? "Google configuration does not match between the browser and the authentication backend." : "إعداد Google غير متطابق بين المتصفح وخادم المصادقة."
    };
    setGoogleStatus(host, messages[error.message] || (english ? "Google sign-in could not be completed. Try again." : "تعذر إكمال تسجيل الدخول عبر Google. حاول مرة أخرى."));
  } finally {
    host.closest(".auth-google-area")?.classList.remove("is-busy");
  }
}

async function mountGoogleButton(host) {
  if (host.dataset.googleMounted === "true") return;
  const clientId = String(config().googleClientId || "").trim();
  const english = languageFor(host) === "en";
  if (!clientId) {
    host.dataset.googleMounted = "recovery";
    setGoogleStatus(host, english ? "Google sign-in is not configured in this frontend." : "إعداد Google غير مكتمل في الواجهة.");
    activateRecovery(host, english, "missing_client_id");
    return;
  }
  host.dataset.googleMounted = "true";
  try {
    const [google, nonce] = await Promise.all([loadGoogleIdentity(), requestNonce(), assertBackendClientId(clientId)]);
    google.accounts.id.initialize({
      client_id: clientId,
      nonce,
      auto_select: false,
      cancel_on_tap_outside: true,
      use_fedcm_for_prompt: true,
      context: host.dataset.context === "register" ? "signup" : "signin",
      callback: (response) => {
        if (!response?.credential) return setGoogleStatus(host, english ? "Google did not return a valid credential." : "لم يعُد Google ببيانات دخول صالحة.");
        void submitCredential(host, response.credential);
      }
    });
    host.replaceChildren();
    google.accounts.id.renderButton(host, {
      type: "standard",
      theme: host.closest("[data-auth-theme]")?.dataset.authTheme === "dark" ? "filled_black" : "outline",
      size: "large",
      shape: "rectangular",
      text: "continue_with",
      logo_alignment: "left",
      width: Math.max(240, Math.min(420, Math.floor(host.getBoundingClientRect().width || 420))),
      locale: english ? "en" : "ar"
    });
  } catch (error) {
    host.dataset.googleMounted = "recovery";
    const reason = String(error?.message || "google_unavailable");
    const messages = {
      auth_backend_required: english ? "The Render authentication backend URL is not configured." : "عنوان خادم المصادقة على Render غير مضبوط.",
      google_client_mismatch: english ? "Google Client ID differs between Vercel and Render." : "معرّف Google مختلف بين Vercel وRender.",
      google_backend_unavailable: english ? "The authentication backend is temporarily unavailable." : "خادم المصادقة غير متاح مؤقتًا.",
      google_library_unavailable: english ? "Google was blocked by the browser. Disable content blocking or try a private window, then retry." : "حجب المتصفح Google. عطّل مانع المحتوى أو جرّب نافذة خاصة، ثم أعد المحاولة."
    };
    setGoogleStatus(host, messages[reason] || (english ? "Google could not be loaded. Retry or use the secure Google page." : "تعذّر تحميل Google. أعد المحاولة أو استخدم صفحة Google الآمنة."));
    activateRecovery(host, english, reason === "google_library_unavailable" ? "sdk_blocked" : reason);
  }
}

export const AuthGoogle = {
  mountAll(root = document) {
    renderKnownAccount(root);
    root.querySelectorAll("[data-auth-google]").forEach((host) => void mountGoogleButton(host));
  },
  rememberAccount(user) {
    if (!user?.email) return;
    try {
      localStorage.setItem(KNOWN_ACCOUNT_KEY, JSON.stringify({ email: user.email, name: user.name || "", image: user.image || "" }));
    } catch {
      // Authentication must remain available when storage is disabled.
    }
  }
};
