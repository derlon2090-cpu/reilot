const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const widgets = new WeakMap();
let scriptPromise;

function loadScript() {
  if (window.turnstile?.render) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-renvix-turnstile]');
    const script = existing || document.createElement("script");
    const finish = () => window.turnstile?.render ? resolve(window.turnstile) : reject(new Error("turnstile_unavailable"));
    script.addEventListener("load", finish, { once: true });
    script.addEventListener("error", () => reject(new Error("turnstile_unavailable")), { once: true });
    if (!existing) {
      script.src = SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.dataset.renvixTurnstile = "true";
      document.head.appendChild(script);
    }
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

function message(slot, text) {
  const node = slot.querySelector("[data-turnstile-message]");
  if (node) node.textContent = text;
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
      slot.innerHTML = '<input type="hidden" name="turnstileToken" value=""><div class="auth-turnstile-widget" data-turnstile-widget></div><small class="auth-turnstile-message" data-turnstile-message aria-live="polite"></small>';
      form.insertBefore(slot, submit);
    }
    const slots = [...root.querySelectorAll("[data-auth-turnstile]")];
    if (!slots.length) return;

    for (const slot of slots) {
      const form = slot.closest("form");
      if (!form || widgets.has(form)) continue;
      setReady(form, false);
      if (!siteKey) {
        message(slot, form.closest('[data-auth-language="en"]') ? "Security verification is temporarily unavailable." : "تعذر تحميل التحقق الأمني مؤقتًا.");
        continue;
      }
      try {
        const api = await loadScript();
        if (!slot.isConnected) continue;
        const input = form.querySelector('input[name="turnstileToken"]');
        const page = form.closest("[data-auth-theme]");
        const widgetId = api.render(slot.querySelector("[data-turnstile-widget]"), {
          sitekey: siteKey,
          action: slot.dataset.authTurnstile,
          appearance: "interaction-only",
          size: "flexible",
          theme: page?.dataset.authTheme === "dark" ? "dark" : "light",
          language: page?.dataset.authLanguage === "en" ? "en" : "ar",
          callback(token) {
            if (input) input.value = token;
            message(slot, "");
            setReady(form, true);
          },
          "expired-callback"() {
            setReady(form, false);
            message(slot, page?.dataset.authLanguage === "en" ? "Verification expired. Please try again." : "انتهت صلاحية التحقق. حاول مرة أخرى.");
          },
          "error-callback"() {
            setReady(form, false);
            message(slot, page?.dataset.authLanguage === "en" ? "Security verification failed. Please try again." : "تعذر إكمال التحقق الأمني. حاول مرة أخرى.");
          }
        });
        widgets.set(form, { id: widgetId, api, slot });
      } catch {
        setReady(form, false);
        message(slot, form.closest('[data-auth-language="en"]') ? "Security verification is temporarily unavailable." : "تعذر تحميل التحقق الأمني مؤقتًا.");
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
