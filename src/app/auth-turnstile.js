const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const widgets = new WeakMap();
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

function status(slot, page, state, code = "") {
  const title = slot.querySelector("[data-turnstile-status-title]");
  const copy = slot.querySelector("[data-turnstile-status-copy]");
  if (title) title.textContent = localized(page, "Security verification", "التحقق الأمني");
  if (copy) {
    const values = {
      loading: localized(page, "Checking…", "جاري التحقق…"),
      verified: localized(page, "Verified", "تم التحقق"),
      pending: localized(page, "Refreshing…", "تحديث التحقق…"),
      error: localized(page, `Retrying (${code || "unknown"})`, `إعادة المحاولة (${code || "unknown"})`)
    };
    copy.textContent = values[state] || values.loading;
  }
  slot.dataset.turnstileStatus = state;
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
      slot.innerHTML = '<input type="hidden" name="turnstileToken" value=""><div class="auth-turnstile-status" role="status"><i aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3.3 19 6v5.2c0 4.5-2.8 7.8-7 9.5-4.2-1.7-7-5-7-9.5V6l7-2.7Z"/><path d="m8.7 12 2.1 2.1 4.7-4.7"/></svg></i><span><strong data-turnstile-status-title></strong><small>Cloudflare Turnstile</small></span><b data-turnstile-status-copy></b></div><div class="auth-turnstile-widget" data-turnstile-widget></div><small class="auth-turnstile-message" data-turnstile-message aria-live="polite"></small>';
      form.insertBefore(slot, submit);
    }
    const slots = [...root.querySelectorAll("[data-auth-turnstile]")];
    if (!slots.length) return;

    for (const slot of slots) {
      const form = slot.closest("form");
      if (!form || widgets.has(form)) continue;
      const page = form.closest("[data-auth-theme]");
      setReady(form, false);
      status(slot, page, "loading");
      if (!siteKey) {
        console.error("[Renvix Turnstile]", { errorCode: "configuration" });
        status(slot, page, "error", "configuration");
        message(slot, localized(page, "Security verification is temporarily unavailable (configuration).", "تعذر تحميل التحقق الأمني مؤقتًا (رمز configuration)."), "error");
        continue;
      }
      try {
        const api = await loadScript();
        if (!slot.isConnected) continue;
        const input = form.querySelector('input[name="turnstileToken"]');
        const widgetId = api.render(slot.querySelector("[data-turnstile-widget]"), {
          sitekey: siteKey,
          action: slot.dataset.authTurnstile,
          appearance: "always",
          size: "flexible",
          theme: page?.dataset.authTheme === "dark" ? "dark" : "light",
          language: page?.dataset.authLanguage === "en" ? "en" : "ar",
          retry: "auto",
          "retry-interval": 8000,
          "refresh-expired": "auto",
          "refresh-timeout": "auto",
          callback(token) {
            if (input) input.value = token;
            message(slot, "");
            status(slot, page, "verified");
            setReady(form, true);
          },
          "expired-callback"() {
            setReady(form, false);
            status(slot, page, "pending");
            message(slot, localized(page, "Verification expired. A fresh check is loading.", "انتهت صلاحية التحقق، ويجري تحميل تحقق جديد."), "pending");
          },
          "error-callback"(errorCode) {
            const code = String(errorCode || "unknown");
            console.error("[Renvix Turnstile]", { errorCode: code });
            setReady(form, false);
            status(slot, page, "error", code);
            message(slot, localized(page, `Security verification failed (code ${code}). Retrying automatically.`, `تعذر إكمال التحقق الأمني (الرمز ${code})، وستتم إعادة المحاولة تلقائيًا.`), "error");
            return false;
          },
          "timeout-callback"() {
            setReady(form, false);
            status(slot, page, "pending");
            message(slot, localized(page, "The security check timed out. A fresh check is loading.", "انتهت مهلة التحقق الأمني، ويجري تحميل تحقق جديد."), "pending");
          },
          "unsupported-callback"() {
            console.error("[Renvix Turnstile]", { errorCode: "unsupported-browser" });
            setReady(form, false);
            status(slot, page, "error", "unsupported-browser");
            message(slot, localized(page, "This browser cannot complete the security check (unsupported-browser).", "هذا المتصفح لا يدعم التحقق الأمني (الرمز unsupported-browser)."), "error");
          }
        });
        widgets.set(form, { id: widgetId, api, slot });
      } catch {
        setReady(form, false);
        console.error("[Renvix Turnstile]", { errorCode: "script-load" });
        status(slot, page, "error", "script-load");
        message(slot, localized(page, "Security verification is temporarily unavailable (script-load).", "تعذر تحميل التحقق الأمني مؤقتًا (الرمز script-load)."), "error");
      }
    }
  },

  reset(form) {
    const widget = widgets.get(form);
    setReady(form, false);
    if (!widget) return;
    try { widget.api.reset(widget.id); } catch { /* the next render creates a fresh widget */ }
  },

  hasToken(form) {
    return Boolean(form?.querySelector('input[name="turnstileToken"]')?.value);
  }
};
