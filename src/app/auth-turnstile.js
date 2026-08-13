const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const widgets = new WeakMap();
const AUTOMATIC_RETRY_DELAYS = [1500, 4000];
let scriptPromise;

function loadScript() {
  if (window.turnstile?.render) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;
  const pending = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-renvix-turnstile]');
    const script = existing || document.createElement("script");
    let timeoutId;
    const cleanup = () => {
      clearTimeout(timeoutId);
      script.removeEventListener("load", finish);
      script.removeEventListener("error", fail);
    };
    const finish = () => {
      cleanup();
      if (window.turnstile?.render) resolve(window.turnstile);
      else fail();
    };
    const fail = () => {
      cleanup();
      if (script.isConnected) script.remove();
      reject(new Error("turnstile_unavailable"));
    };
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", fail, { once: true });
    timeoutId = setTimeout(fail, 12000);
    if (!existing) {
      script.src = SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.dataset.renvixTurnstile = "true";
      document.head.appendChild(script);
    }
  });
  scriptPromise = pending.catch((error) => {
    scriptPromise = undefined;
    throw error;
  });
  return scriptPromise;
}

function submitButton(form) {
  return form.querySelector('button[type="submit"], button.auth-submit:not([type])');
}

function setReady(form, ready) {
  const input = form.querySelector('input[name="turnstileToken"]');
  const button = submitButton(form);
  if (button) button.disabled = !ready;
  form.dataset.turnstileReady = ready ? "true" : "false";
  if (!ready && input) input.value = "";
}

function message(slot, text, state = "") {
  const node = slot.querySelector("[data-turnstile-message]");
  if (!node) return;
  node.textContent = text;
  if (state) node.dataset.state = state;
  else delete node.dataset.state;
}

function localized(page, english, arabic) {
  return page?.dataset.authLanguage === "en" ? english : arabic;
}

function status(slot, state) {
  slot.dataset.turnstileStatus = state;
}

function retryButton(slot, visible) {
  const button = slot.querySelector("[data-turnstile-retry]");
  if (button) button.hidden = !visible;
}

function retryableError(code) {
  return code.startsWith("300")
    || code.startsWith("600")
    || ["110600", "110620", "200500", "internal-error", "unknown"].includes(code);
}

function configurationError(code) {
  return ["110100", "110110", "110200"].includes(code);
}

export const AuthTurnstile = {
  async mountAll(root = document) {
    const siteKey = String(window.__RENVIX_CONFIG__?.turnstileSiteKey || document.querySelector('meta[name="renvix-turnstile-site-key"]')?.content || "").trim();
    const actionByForm = {
      login: "login",
      register: "register",
      forgot: "forgot_password",
      "reset-password": "reset_password"
    };
    for (const form of root.querySelectorAll("form[data-submit]")) {
      const action = actionByForm[form.dataset.submit];
      if (!action || form.querySelector("[data-auth-turnstile]")) continue;
      const submit = submitButton(form);
      if (!submit) continue;
      const slot = document.createElement("div");
      slot.className = "auth-turnstile-slot";
      slot.dataset.authTurnstile = action;
      slot.innerHTML = '<input type="hidden" name="turnstileToken" value=""><div class="auth-turnstile-widget" data-turnstile-widget></div><small class="auth-turnstile-message" data-turnstile-message aria-live="polite"></small><button type="button" class="auth-turnstile-retry" data-turnstile-retry hidden>إعادة التحقق الأمني</button>';
      form.insertBefore(slot, submit);
    }
    const slots = [...root.querySelectorAll("[data-auth-turnstile]")];
    if (!slots.length) return;

    for (const slot of slots) {
      const form = slot.closest("form");
      if (!form || widgets.has(form)) continue;
      const page = form.closest("[data-auth-theme]");
      const retryControl = slot.querySelector("[data-turnstile-retry]");
      if (retryControl) retryControl.textContent = localized(page, "Retry security verification", "إعادة التحقق الأمني");
      setReady(form, false);
      status(slot, "loading");
      if (!siteKey) {
        console.error("[Renvix Turnstile]", { errorCode: "configuration" });
        status(slot, "error");
        message(slot, localized(page, "Security verification is temporarily unavailable (configuration).", "تعذر تحميل التحقق الأمني مؤقتًا (رمز configuration)."), "error");
        continue;
      }
      try {
        const api = await loadScript();
        if (!slot.isConnected) continue;
        const input = form.querySelector('input[name="turnstileToken"]');
        const manualRetry = slot.querySelector("[data-turnstile-retry]");
        let retryCount = 0;
        let retryTimer;
        let widgetId;
        const resetWidget = ({ manual = false } = {}) => {
          clearTimeout(retryTimer);
          if (manual) retryCount = 0;
          retryButton(slot, false);
          setReady(form, false);
          status(slot, "pending");
          message(slot, localized(page, "Loading a fresh security check…", "جارٍ تحميل تحقق أمني جديد…"), "pending");
          try { api.reset(widgetId); } catch { /* a future page render creates a fresh widget */ }
        };
        manualRetry?.addEventListener("click", () => resetWidget({ manual: true }));
        widgetId = api.render(slot.querySelector("[data-turnstile-widget]"), {
          sitekey: siteKey,
          action: slot.dataset.authTurnstile,
          appearance: "always",
          size: "flexible",
          theme: page?.dataset.authTheme === "dark" ? "dark" : "light",
          language: page?.dataset.authLanguage === "en" ? "en" : "ar",
          retry: "never",
          "refresh-expired": "auto",
          "refresh-timeout": "never",
          callback(token) {
            clearTimeout(retryTimer);
            retryCount = 0;
            if (input) input.value = token;
            retryButton(slot, false);
            message(slot, "");
            status(slot, "verified");
            setReady(form, true);
          },
          "expired-callback"() {
            retryButton(slot, false);
            setReady(form, false);
            status(slot, "pending");
            message(slot, localized(page, "Verification expired. A fresh check is loading.", "انتهت صلاحية التحقق، ويجري تحميل تحقق جديد."), "pending");
          },
          "error-callback"(errorCode) {
            const code = String(errorCode || "unknown");
            console.error("[Renvix Turnstile]", { errorCode: code });
            setReady(form, false);
            if (retryableError(code) && retryCount < AUTOMATIC_RETRY_DELAYS.length) {
              const delay = AUTOMATIC_RETRY_DELAYS[retryCount];
              retryCount += 1;
              status(slot, "pending");
              message(slot, localized(page, `Security check interrupted. Retrying (${retryCount}/${AUTOMATIC_RETRY_DELAYS.length})…`, `انقطع التحقق الأمني، وتجري إعادة المحاولة (${retryCount}/${AUTOMATIC_RETRY_DELAYS.length})…`), "pending");
              retryTimer = setTimeout(() => {
                if (slot.isConnected) resetWidget();
              }, delay);
            } else {
              status(slot, "error");
              retryButton(slot, !configurationError(code));
              message(
                slot,
                configurationError(code)
                  ? localized(page, "Security verification is misconfigured. Please contact support.", "إعداد التحقق الأمني غير صحيح. تواصل مع الدعم.")
                  : localized(page, "Security verification could not finish. Retry it, and disable any VPN or content blocker if the issue continues.", "تعذر إكمال التحقق الأمني. أعد التحقق، وعطّل VPN أو مانع المحتوى إذا استمرت المشكلة."),
                "error"
              );
            }
            return true;
          },
          "timeout-callback"() {
            setReady(form, false);
            status(slot, "pending");
            message(slot, localized(page, "The security check timed out. A fresh check is loading.", "انتهت مهلة التحقق الأمني، ويجري تحميل تحقق جديد."), "pending");
            setTimeout(() => {
              if (slot.isConnected) resetWidget();
            }, 700);
          },
          "unsupported-callback"() {
            console.error("[Renvix Turnstile]", { errorCode: "unsupported-browser" });
            setReady(form, false);
            status(slot, "error");
            message(slot, localized(page, "This browser cannot complete the security check (unsupported-browser).", "هذا المتصفح لا يدعم التحقق الأمني (الرمز unsupported-browser)."), "error");
          }
        });
        widgets.set(form, { reset: resetWidget, slot });
      } catch {
        setReady(form, false);
        console.error("[Renvix Turnstile]", { errorCode: "script-load" });
        status(slot, "error");
        retryButton(slot, true);
        message(slot, localized(page, "Security verification could not load. Check your connection and retry.", "تعذر تحميل التحقق الأمني. تحقق من الاتصال ثم أعد المحاولة."), "error");
        retryControl?.addEventListener("click", () => {
          retryButton(slot, false);
          status(slot, "loading");
          message(slot, localized(page, "Loading security verification…", "جارٍ تحميل التحقق الأمني…"), "pending");
          void AuthTurnstile.mountAll(root);
        }, { once: true });
      }
    }
  },

  reset(form) {
    const widget = widgets.get(form);
    setReady(form, false);
    if (!widget) return;
    widget.reset({ manual: true });
  },

  hasToken(form) {
    return Boolean(form?.querySelector('input[name="turnstileToken"]')?.value);
  }
};
