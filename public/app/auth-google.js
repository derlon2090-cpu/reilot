const GOOGLE_SCRIPT_URL = "https://accounts.google.com/gsi/client";
const KNOWN_ACCOUNT_KEY = "renvix.auth.known-account.v1";
const PRODUCTION_AUTH_API_ORIGIN = "https://api.renvix.app";
let googleScriptPromise;

function config() {
  return window.__RENVIX_CONFIG__ || {};
}

function normalizedOrigin(value) {
  try {
    const url = new URL(String(value || "").trim());
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.origin : "";
  } catch {
    return "";
  }
}

function authApiBaseUrl() {
  const configured = normalizedOrigin(config().authApiUrl);
  if (configured) return configured;
  if (/^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)) return window.location.origin;
  return window.location.hostname === "renvix.app" || window.location.hostname.endsWith(".renvix.app")
    ? PRODUCTION_AUTH_API_ORIGIN
    : "";
}

function authApiUrl(path) {
  const baseUrl = authApiBaseUrl();
  if (!baseUrl) throw new Error("auth_backend_required");
  return new URL(path, baseUrl).toString();
}

function languageFor(element) {
  return element?.closest?.("[data-auth-language]")?.dataset.authLanguage === "en" ? "en" : "ar";
}

function intentFor(host) {
  return host?.dataset?.context === "register" ? "register" : "login";
}

function setGoogleStatus(host, text = "", tone = "error") {
  const status = host.parentElement?.querySelector("[data-auth-google-status]");
  if (!status) return;
  status.hidden = !text;
  status.dataset.tone = tone;
  status.textContent = text;
}

function normalizeGoogleClientId(value) {
  const candidate = String(value || "").trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  return /^[a-z0-9][a-z0-9._-]*\.apps\.googleusercontent\.com$/i.test(candidate) ? candidate : "";
}

function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (googleScriptPromise) return googleScriptPromise;
  googleScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src^="${GOOGLE_SCRIPT_URL}"]`);
    const script = existing || document.createElement("script");
    const finish = () => window.google?.accounts?.id ? resolve(window.google) : reject(new Error("google_library_unavailable"));
    const fail = () => reject(new Error("google_library_unavailable"));
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", fail, { once: true });
    if (!existing) {
      script.src = GOOGLE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.referrerPolicy = "no-referrer";
      document.head.appendChild(script);
    }
    window.setTimeout(fail, 10000);
  }).catch((error) => {
    document.querySelector(`script[src^="${GOOGLE_SCRIPT_URL}"]`)?.remove();
    googleScriptPromise = undefined;
    throw error;
  });
  return googleScriptPromise;
}

async function requestGoogleConfig() {
  const response = await fetch(authApiUrl("/api/auth/google/config"), { credentials: "include", cache: "no-store", mode: "cors" });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.reason || "google_backend_unavailable");
  const clientId = normalizeGoogleClientId(payload?.clientId);
  if (!clientId) throw new Error("google_backend_not_configured");
  return clientId;
}

async function requestGoogleNonce() {
  const response = await fetch(authApiUrl("/api/auth/google/nonce"), { credentials: "include", cache: "no-store", mode: "cors" });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.nonce) throw new Error(payload?.reason || "google_nonce_unavailable");
  return payload.nonce;
}

function googleOAuthUrl(host) {
  const baseUrl = authApiBaseUrl();
  if (!baseUrl) return "";
  const target = new URL("/api/auth/google/start", baseUrl);
  target.searchParams.set("locale", languageFor(host));
  target.searchParams.set("intent", intentFor(host));
  return target.toString();
}

function googlePlaceholder(english, retry = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "auth-google-placeholder";
  button.innerHTML = `<svg aria-hidden="true" viewBox="0 0 18 18"><path fill="#4285f4" d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.482h4.844a4.14 4.14 0 0 1-1.797 2.716v2.258h2.91c1.704-1.568 2.683-3.88 2.683-6.615Z"/><path fill="#34a853" d="M9 18c2.43 0 4.467-.806 5.957-2.18l-2.91-2.258c-.806.54-1.835.858-3.047.858-2.344 0-4.328-1.585-5.037-3.714H.956v2.333A8.998 8.998 0 0 0 9 18Z"/><path fill="#fbbc05" d="M3.963 10.706A5.41 5.41 0 0 1 3.68 9c0-.592.102-1.167.283-1.706V4.961H.956A8.996 8.996 0 0 0 0 9c0 1.452.347 2.827.956 4.039l3.007-2.333Z"/><path fill="#ea4335" d="M9 3.58c1.322 0 2.508.454 3.442 1.346l2.58-2.58C13.463.892 11.426 0 9 0A8.998 8.998 0 0 0 .956 4.961l3.007 2.333C4.672 5.165 6.656 3.58 9 3.58Z"/></svg><span>${retry ? (english ? "Retry Google" : "إعادة محاولة Google") : (english ? "Continue with Google" : "المتابعة عبر Google")}</span>`;
  return button;
}

function showGoogleRecovery(host, english, reason) {
  host.dataset.googleMounted = "recovery";
  host.replaceChildren();
  const retry = googlePlaceholder(english, true);
  retry.addEventListener("click", () => {
    retry.disabled = true;
    delete host.dataset.googleMounted;
    void mountGoogleButton(host);
  }, { once: true });
  host.append(retry);
  const area = host.closest(".auth-google-area");
  if (area && !area.querySelector("[data-google-server-fallback]")) {
    const fallback = document.createElement("button");
    fallback.type = "button";
    fallback.className = "auth-google-server-fallback";
    fallback.dataset.googleServerFallback = "true";
    fallback.textContent = english ? "Continue on Google's secure page" : "المتابعة عبر صفحة Google الآمنة";
    fallback.addEventListener("click", () => {
      const target = googleOAuthUrl(host);
      if (!target) return;
      fallback.disabled = true;
      window.location.assign(target);
    });
    area.append(fallback);
  }
  const messages = {
    auth_backend_required: english ? "The secure authentication backend is not connected." : "خادم المصادقة الآمن غير متصل.",
    google_backend_unavailable: english ? "The authentication backend is temporarily unavailable." : "خادم المصادقة غير متاح مؤقتًا.",
    google_backend_not_configured: english ? "Google is not configured correctly on the authentication backend." : "إعداد Google غير مكتمل على خادم المصادقة.",
    google_not_configured: english ? "Google is not configured correctly on the authentication backend." : "إعداد Google غير مكتمل على خادم المصادقة.",
    google_library_unavailable: english ? "Google was blocked by the browser. Retry or use Google's secure page." : "حجب المتصفح خدمة Google. أعد المحاولة أو استخدم صفحة Google الآمنة.",
    google_nonce_unavailable: english ? "The secure Google session could not be prepared. Retry." : "تعذر تجهيز جلسة Google الآمنة. أعد المحاولة."
  };
  setGoogleStatus(host, messages[reason] || (english ? "Google sign-in could not be prepared. Retry." : "تعذر تجهيز تسجيل Google. أعد المحاولة."));
  host.closest(".auth-google-area")?.classList.remove("is-busy");
}

async function submitGoogleCredential(host, credential) {
  const english = languageFor(host) === "en";
  const intent = intentFor(host);
  host.closest(".auth-google-area")?.classList.add("is-busy");
  setGoogleStatus(host, intent === "register"
    ? (english ? "Creating your account securely…" : "جارٍ إنشاء حسابك بأمان…")
    : (english ? "Signing in securely…" : "جارٍ تسجيل الدخول بأمان…"), "info");
  try {
    const response = await fetch(authApiUrl("/api/auth/google"), {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      mode: "cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential, locale: english ? "en" : "ar", intent })
    });
    const payload = await response.json().catch(() => null);
    window.dispatchEvent(new CustomEvent("renvix:google-auth-result", { detail: { responseOk: response.ok, status: response.status, payload, intent } }));
    if (!response.ok || payload?.ok !== true) throw new Error(payload?.reason || "google_auth_failed");
    setGoogleStatus(host, "", "info");
  } catch (error) {
    const reason = String(error?.message || "google_auth_failed");
    setGoogleStatus(
      host,
      english ? "Google sign-in could not be completed. Please retry." : "تعذر إكمال التسجيل عبر Google. أعد المحاولة.",
      "error"
    );
    delete host.dataset.googleMounted;
    googleScriptPromise = undefined;
    showGoogleRecovery(host, english, reason);
  } finally {
    host.closest(".auth-google-area")?.classList.remove("is-busy");
  }
}

async function mountGoogleButton(host) {
  if (["loading", "true"].includes(host.dataset.googleMounted || "")) return;
  const english = languageFor(host) === "en";
  host.dataset.googleMounted = "loading";
  host.closest(".auth-google-area")?.classList.add("is-busy");
  setGoogleStatus(host, english ? "Preparing secure Google sign-in…" : "جارٍ تجهيز تسجيل Google الآمن…", "info");
  try {
    const [clientId, nonce, google] = await Promise.all([requestGoogleConfig(), requestGoogleNonce(), loadGoogleIdentity()]);
    google.accounts.id.initialize({
      client_id: clientId,
      nonce,
      auto_select: false,
      cancel_on_tap_outside: true,
      context: intentFor(host) === "register" ? "signup" : "signin",
      callback: (response) => {
        if (!response?.credential) return showGoogleRecovery(host, english, "google_credential_missing");
        void submitGoogleCredential(host, response.credential);
      }
    });
    host.replaceChildren();
    google.accounts.id.renderButton(host, {
      type: "standard",
      theme: host.closest("[data-auth-theme]")?.dataset.authTheme === "dark" ? "filled_black" : "outline",
      size: "large",
      shape: "rectangular",
      text: intentFor(host) === "register" ? "signup_with" : "signin_with",
      logo_alignment: "left",
      width: Math.max(240, Math.min(420, Math.floor(host.getBoundingClientRect().width || 420))),
      locale: english ? "en" : "ar"
    });
    host.dataset.googleMounted = "true";
    host.closest(".auth-google-area")?.querySelector("[data-google-server-fallback]")?.remove();
    setGoogleStatus(host, "", "info");
  } catch (error) {
    showGoogleRecovery(host, english, String(error?.message || "google_unavailable"));
  } finally {
    host.closest(".auth-google-area")?.classList.remove("is-busy");
  }
}

function readKnownAccount() {
  try {
    const value = JSON.parse(localStorage.getItem(KNOWN_ACCOUNT_KEY) || "null");
    if (!value || !/^\S+@\S+\.\S+$/.test(String(value.email || ""))) return null;
    return {
      email: String(value.email).slice(0, 254),
      name: String(value.name || "").slice(0, 160),
      image: /^https:\/\//i.test(String(value.image || "")) ? String(value.image).slice(0, 1000) : ""
    };
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
  } else {
    avatar.textContent = initials(account);
  }
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

export const AuthGoogle = {
  mountAll(root = document) {
    renderKnownAccount(root);
    root.querySelectorAll("[data-auth-google]").forEach((host) => { void mountGoogleButton(host); });
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
