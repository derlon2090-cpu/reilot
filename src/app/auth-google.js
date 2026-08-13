const KNOWN_ACCOUNT_KEY = "renvix.auth.known-account.v1";
const PRODUCTION_AUTH_API_ORIGIN = "https://api.renvix.app";

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

function googleOAuthUrl(host) {
  const baseUrl = authApiBaseUrl();
  if (!baseUrl) return "";
  const target = new URL("/api/auth/google/start", baseUrl);
  target.searchParams.set("locale", languageFor(host));
  target.searchParams.set("intent", intentFor(host));
  return target.toString();
}

function restoreGoogleButton(host, button) {
  host.closest(".auth-google-area")?.classList.remove("is-busy");
  button.disabled = false;
  delete button.dataset.googleNavigating;
}

function mountGoogleButton(host) {
  if (host.dataset.googleMounted === "true") return;
  const english = languageFor(host) === "en";
  const button = host.querySelector(".auth-google-placeholder");
  const target = googleOAuthUrl(host);
  if (!button || !target) {
    if (button) button.disabled = true;
    host.dataset.googleMounted = "error";
    setGoogleStatus(
      host,
      english ? "The secure Google sign-in service is temporarily unavailable." : "خدمة تسجيل الدخول الآمن عبر Google غير متاحة مؤقتًا."
    );
    return;
  }

  host.dataset.googleMounted = "true";
  button.disabled = false;
  button.dataset.googleOAuth = "true";
  button.addEventListener("click", () => {
    if (button.dataset.googleNavigating === "true") return;
    button.dataset.googleNavigating = "true";
    button.disabled = true;
    host.closest(".auth-google-area")?.classList.add("is-busy");
    setGoogleStatus(
      host,
      english ? "Opening Google's secure sign-in page…" : "جارٍ فتح صفحة Google الآمنة…",
      "info"
    );
    window.location.assign(target);
    window.setTimeout(() => {
      if (document.visibilityState === "visible") restoreGoogleButton(host, button);
    }, 5000);
  });
  window.addEventListener("pageshow", () => restoreGoogleButton(host, button), { once: true });
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
    root.querySelectorAll("[data-auth-google]").forEach((host) => mountGoogleButton(host));
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
