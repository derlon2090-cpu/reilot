export const HONEYPOT_SCRIPT_PATH = "/__renvix/honeypot.js";
export const HONEYPOT_TELEMETRY_PATH = "/__renvix/telemetry";

export const HONEYPOT_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <title>بوابة الإدارة</title>
  <style>
    :root{color-scheme:light;--ink:#123b38;--muted:#718783;--line:#dce8e6;--brand:#0b5650;--soft:#f3f8f7}
    *{box-sizing:border-box}body{min-height:100vh;margin:0;display:grid;place-items:center;padding:24px;background:linear-gradient(150deg,#f7fbfa,#e7f1ef);font-family:Tahoma,Arial,sans-serif;color:var(--ink)}
    main{width:min(100%,420px);padding:34px;border:1px solid rgba(210,228,224,.9);border-radius:22px;background:rgba(255,255,255,.96);box-shadow:0 24px 70px rgba(10,66,60,.12)}
    .mark{width:52px;height:52px;display:grid;place-items:center;margin-bottom:24px;border-radius:15px;background:var(--brand);color:#fff;font-size:23px;font-weight:900}
    h1{margin:0 0 8px;font-size:25px}p{margin:0 0 27px;color:var(--muted);font-size:13px;line-height:1.8}
    form{display:grid;gap:16px}label{display:grid;gap:7px;font-size:12px;font-weight:700}input{width:100%;height:47px;padding:0 13px;border:1px solid var(--line);border-radius:11px;background:#fff;color:var(--ink);font:inherit;outline:none}input:focus{border-color:#62a99f;box-shadow:0 0 0 3px rgba(11,86,80,.09)}
    button{height:48px;border:0;border-radius:11px;background:var(--brand);color:#fff;font:inherit;font-weight:800;cursor:pointer}button:disabled{opacity:.72;cursor:wait}
    #status{min-height:19px;margin:0;color:#a33b3b;font-size:12px;text-align:center}.foot{margin:24px 0 0;padding-top:18px;border-top:1px solid var(--line);text-align:center;font-size:11px;color:#91a29f}
    @media(max-width:480px){body{padding:14px}main{padding:26px 21px;border-radius:18px}}
  </style>
</head>
<body data-honeypot-shell="v2">
  <main>
    <div class="mark" aria-hidden="true">R</div>
    <h1>تسجيل دخول الإدارة</h1>
    <p>أدخل بيانات الوصول للمتابعة إلى لوحة التحكم.</p>
    <form id="admin-login" autocomplete="off" novalidate>
      <label>البريد الإلكتروني أو اسم المستخدم<input id="identity" type="text" autocomplete="off" spellcheck="false"></label>
      <label>كلمة المرور<input id="password" type="password" autocomplete="new-password"></label>
      <button id="submit" type="submit">تسجيل الدخول</button>
      <p id="status" role="status" aria-live="polite"></p>
    </form>
    <p class="foot">بوابة وصول محمية</p>
  </main>
  <script src="${HONEYPOT_SCRIPT_PATH}" defer></script>
</body>
</html>`;

export const HONEYPOT_SCRIPT = `(() => {
  "use strict";
  const endpoint = "${HONEYPOT_TELEMETRY_PATH}";
  const startedAt = Date.now();
  const visitId = globalThis.crypto && typeof globalThis.crypto.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : String(startedAt) + "-" + Math.random().toString(16).slice(2);
  const state = {
    mouseMoves: 0, mouseDistance: 0, clicks: 0, keyPresses: 0,
    scrollDepth: 0, loginAttempts: 0, heatmap: [0,0,0,0,0,0,0,0,0],
    lastX: null, lastY: null, lastMoveAt: 0, dirty: true, transmissions: 0
  };

  const bounded = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const short = (value, max) => String(value || "").slice(0, max);
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection || {};
  const graphics = (() => {
    try {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (!context) return {};
      const extension = context.getExtension("WEBGL_debug_renderer_info");
      return {
        vendor: short(extension ? context.getParameter(extension.UNMASKED_VENDOR_WEBGL) : context.getParameter(context.VENDOR), 120),
        renderer: short(extension ? context.getParameter(extension.UNMASKED_RENDERER_WEBGL) : context.getParameter(context.RENDERER), 180)
      };
    } catch { return {}; }
  })();
  const device = {
    screenWidth: bounded(screen.width, 0, 10000), screenHeight: bounded(screen.height, 0, 10000),
    viewportWidth: bounded(innerWidth, 0, 10000), viewportHeight: bounded(innerHeight, 0, 10000),
    pixelRatio: bounded(devicePixelRatio, 0, 10), colorDepth: bounded(screen.colorDepth, 0, 64),
    timezone: short(Intl.DateTimeFormat().resolvedOptions().timeZone, 80),
    language: short(navigator.language, 40), languages: Array.from(navigator.languages || []).slice(0, 6).map((item) => short(item, 40)),
    platform: short(navigator.userAgentData?.platform || navigator.platform, 80),
    browserBrands: Array.from(navigator.userAgentData?.brands || []).slice(0, 5).map((item) => ({ brand: short(item.brand, 50), version: short(item.version, 20) })),
    mobile: navigator.userAgentData?.mobile === true, vendor: short(navigator.vendor, 80),
    hardwareConcurrency: bounded(navigator.hardwareConcurrency, 0, 256),
    deviceMemory: bounded(navigator.deviceMemory, 0, 128), touchPoints: bounded(navigator.maxTouchPoints, 0, 32),
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
    webdriver: navigator.webdriver === true, connection: short(connection.effectiveType, 20),
    graphicsVendor: graphics.vendor || "", graphicsRenderer: graphics.renderer || ""
  };

  function payload(kind) {
    return {
      kind, visitId, pagePath: short(location.pathname, 300), device,
      interaction: {
        mouseMoves: state.mouseMoves, mouseDistance: Math.round(state.mouseDistance), clicks: state.clicks,
        keyPresses: state.keyPresses, scrollDepth: Math.round(state.scrollDepth), loginAttempts: state.loginAttempts,
        activeMs: bounded(Date.now() - startedAt, 0, 86400000), heatmap: state.heatmap.slice(0, 9)
      }
    };
  }

  function transmit(kind, beacon) {
    if (state.transmissions >= 8 || (!state.dirty && kind === "interaction")) return;
    const body = JSON.stringify(payload(kind));
    state.dirty = false;
    state.transmissions += 1;
    if (beacon && navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, new Blob([body], { type: "text/plain;charset=UTF-8" }));
      return;
    }
    fetch(endpoint, {
      method: "POST", credentials: "omit", cache: "no-store", keepalive: true,
      headers: { "content-type": "application/json" }, body
    }).catch(() => undefined);
  }

  addEventListener("pointermove", (event) => {
    const now = Date.now();
    if (now - state.lastMoveAt < 100) return;
    if (state.lastX !== null) state.mouseDistance += Math.hypot(event.clientX - state.lastX, event.clientY - state.lastY);
    state.lastX = event.clientX; state.lastY = event.clientY; state.lastMoveAt = now; state.mouseMoves += 1;
    const column = Math.min(2, Math.floor((event.clientX / Math.max(innerWidth, 1)) * 3));
    const row = Math.min(2, Math.floor((event.clientY / Math.max(innerHeight, 1)) * 3));
    state.heatmap[(row * 3) + column] += 1; state.dirty = true;
  }, { passive: true });
  addEventListener("pointerdown", () => { state.clicks += 1; state.dirty = true; }, { passive: true });
  addEventListener("keydown", () => { state.keyPresses += 1; state.dirty = true; }, { passive: true });
  addEventListener("scroll", () => {
    const height = Math.max(document.documentElement.scrollHeight - innerHeight, 1);
    state.scrollDepth = Math.max(state.scrollDepth, bounded((scrollY / height) * 100, 0, 100)); state.dirty = true;
  }, { passive: true });
  addEventListener("resize", () => { device.viewportWidth = bounded(innerWidth, 0, 10000); device.viewportHeight = bounded(innerHeight, 0, 10000); state.dirty = true; }, { passive: true });

  document.getElementById("admin-login")?.addEventListener("submit", (event) => {
    event.preventDefault(); state.loginAttempts += 1; state.dirty = true;
    const button = document.getElementById("submit"); const status = document.getElementById("status");
    if (button) button.disabled = true; if (status) status.textContent = "جارٍ التحقق من بيانات الدخول...";
    transmit("login_attempt", false);
    setTimeout(() => { if (button) button.disabled = false; if (status) status.textContent = "تعذر التحقق من بيانات الدخول. حاول مرة أخرى."; }, 900);
  });

  setTimeout(() => transmit("page_view", false), 250);
  setInterval(() => transmit("interaction", false), 15000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") transmit("page_hidden", true); });
  addEventListener("pagehide", () => transmit("page_exit", true));
})();`;
