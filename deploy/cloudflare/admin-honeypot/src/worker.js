import {
  HONEYPOT_HTML, HONEYPOT_PIXEL_PATH, HONEYPOT_SCRIPT, HONEYPOT_SCRIPT_PATH, HONEYPOT_TELEMETRY_PATH
} from "./page.js";

const BASE_HEADERS = Object.freeze({
  "cache-control": "no-store, max-age=0",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "x-robots-tag": "noindex, nofollow, noarchive"
});

const HTML_CSP = "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";
const SCRIPT_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";
const MAX_TELEMETRY_BYTES = 12_288;
const DEVICE_COOKIE = "__Host-renvix_hp_device";
const SHARED_DEVICE_COOKIE = "renvix_honeypot_device";
const DEVICE_ID_PATTERN = /^hpd_[a-f0-9]{32}$/;
const BLOCK_CACHE_TTL_MS = 5_000;
const BLOCK_CACHE_MAX = 1_000;
const blockCache = new Map();
const TRACKING_PIXEL = Uint8Array.from(atob("R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="), (character) => character.charCodeAt(0));

function text(value, max) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
}

function number(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function hex(bytes) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

async function isInternalProbe(request, env, url) {
  if (url.pathname !== "/.well-known/renvix-security-probe") return false;
  const timestamp = request.headers.get("x-renvix-probe-timestamp") || "";
  const signature = request.headers.get("x-renvix-probe-signature") || "";
  if (!env.HONEYPOT_INGESTION_SECRET || Math.abs(Date.now() - Number(timestamp)) > 300_000) return false;
  const expected = await hmac(env.HONEYPOT_INGESTION_SECRET, `${timestamp}.${request.method}.${url.pathname}`);
  return signature.length === expected.length && signature === expected;
}

function response(body, status, contentType, csp = SCRIPT_CSP, extraHeaders = {}, setCookies = []) {
  const headers = new Headers({ ...BASE_HEADERS, "content-type": contentType, "content-security-policy": csp, ...extraHeaders });
  for (const cookie of setCookies.filter(Boolean)) headers.append("set-cookie", cookie);
  return new Response(body, {
    status,
    headers
  });
}

function emptyResponse(status = 204, setCookies = []) {
  return response(null, status, "text/plain; charset=utf-8", SCRIPT_CSP, {}, setCookies);
}

function pageResponse(setCookies = []) {
  return response(HONEYPOT_HTML, 200, "text/html; charset=utf-8", HTML_CSP, {}, setCookies);
}

function scriptResponse(setCookies = []) {
  return response(HONEYPOT_SCRIPT, 200, "application/javascript; charset=utf-8", SCRIPT_CSP, {}, setCookies);
}

function pixelResponse(setCookies = []) {
  return response(TRACKING_PIXEL, 200, "image/gif", SCRIPT_CSP, {}, setCookies);
}

function cookieValue(request, name) {
  for (const part of String(request.headers.get("cookie") || "").split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=").slice(0, 180);
  }
  return "";
}

async function deviceIdentity(request, env) {
  const secret = String(env.HONEYPOT_INGESTION_SECRET || "");
  if (secret.length < 32) return { id: "", setCookies: [], existing: false };
  const supplied = cookieValue(request, DEVICE_COOKIE);
  const separator = supplied.lastIndexOf(".");
  const candidate = separator > 0 ? supplied.slice(0, separator) : "";
  const signature = separator > 0 ? supplied.slice(separator + 1) : "";
  if (DEVICE_ID_PATTERN.test(candidate)) {
    const expected = await hmac(secret, `honeypot-device:${candidate}`);
    if (signature.length === expected.length && signature === expected) {
      const sharedValue = `${candidate}.${expected}`;
      const suppliedShared = cookieValue(request, SHARED_DEVICE_COOKIE);
      return {
        id: candidate,
        setCookies: suppliedShared === sharedValue ? [] : [
          `${SHARED_DEVICE_COOKIE}=${sharedValue}; Domain=renvix.app; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Strict`
        ],
        existing: true
      };
    }
  }
  const id = `hpd_${crypto.randomUUID().replace(/-/g, "")}`;
  const signed = await hmac(secret, `honeypot-device:${id}`);
  return {
    id,
    existing: false,
    setCookies: [
      `${DEVICE_COOKIE}=${id}.${signed}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Strict`,
      `${SHARED_DEVICE_COOKIE}=${id}.${signed}; Domain=renvix.app; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Strict`
    ]
  };
}

function blockCheckUrl(env) {
  try {
    return new URL("/api/security/block-check", env.SECURITY_INGESTION_URL).toString();
  } catch {
    return "";
  }
}

async function checkDeviceBlock(env, deviceId) {
  if (!DEVICE_ID_PATTERN.test(deviceId)) return null;
  const cached = blockCache.get(deviceId);
  if (cached?.expiresAt > Date.now()) return cached.value;
  const endpoint = blockCheckUrl(env);
  const secret = String(env.HONEYPOT_INGESTION_SECRET || "");
  if (!endpoint || secret.length < 32) return null;
  const timestamp = Date.now().toString();
  const body = JSON.stringify({ honeypotDeviceId: deviceId });
  const signature = await hmac(secret, `${timestamp}.${body}`);
  try {
    const result = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", "x-security-timestamp": timestamp, "x-security-signature": signature },
      body,
      signal: AbortSignal.timeout(1_200)
    });
    if (!result.ok) return null;
    const payload = await result.json();
    const decision = payload?.blocked
      ? { blocked: true, referenceId: text(payload.referenceId, 40) || "SEC-UNKNOWN" }
      : { blocked: false };
    if (blockCache.size >= BLOCK_CACHE_MAX) blockCache.delete(blockCache.keys().next().value);
    blockCache.set(deviceId, { value: decision, expiresAt: Date.now() + BLOCK_CACHE_TTL_MS });
    return decision;
  } catch {
    return null;
  }
}

function blockedResponse(referenceId, setCookies = []) {
  const reference = text(referenceId, 40).replace(/[^a-z0-9-]/gi, "") || "SEC-UNKNOWN";
  const body = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>تم حظر الوصول</title><style>:root{color-scheme:light}*{box-sizing:border-box}body{min-height:100vh;margin:0;display:grid;place-items:center;padding:24px;background:linear-gradient(145deg,#eef6f4,#dfecea);font-family:Tahoma,Arial,sans-serif;color:#113c38}.card{width:min(100%,520px);padding:42px 36px;border:1px solid #d4e4e1;border-radius:24px;background:#fff;box-shadow:0 24px 70px #103f381f;text-align:center}.icon{width:70px;height:70px;margin:0 auto 22px;display:grid;place-items:center;border-radius:50%;background:#fff1f0;color:#b42318;font-size:32px}h1{margin:0 0 12px;font-size:28px}p{margin:0;color:#647b77;line-height:1.9}.ref{margin:24px 0;padding:13px;border-radius:10px;background:#f3f7f6;font:700 13px monospace;direction:ltr}a{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 24px;border-radius:11px;background:#0b5650;color:#fff;text-decoration:none;font-weight:800}</style></head><body><main class="card"><div class="icon" aria-hidden="true">!</div><h1>تم حظر الوصول</h1><p>تعذر إكمال طلبك بسبب سياسة الحماية. إذا كنت تعتقد أن هذا الإجراء حدث بالخطأ، راجع فريق الدعم واذكر الرقم المرجعي.</p><div class="ref">${reference}</div><a href="mailto:support@renvix.app?subject=Security%20block%20review">مراجعة الحظر مع الدعم</a></main></body></html>`;
  return response(body, 403, "text/html; charset=utf-8", HTML_CSP, {}, setCookies);
}

function normalizeTelemetry(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const device = input.device && typeof input.device === "object" ? input.device : {};
  const interaction = input.interaction && typeof input.interaction === "object" ? input.interaction : {};
  return {
    kind: ["page_view", "interaction", "login_attempt", "page_hidden", "page_exit"].includes(input.kind) ? input.kind : "interaction",
    visitId: text(input.visitId, 80),
    pagePath: text(input.pagePath, 300).split("?")[0] || "/",
    device: {
      screenWidth: number(device.screenWidth, 0, 10_000), screenHeight: number(device.screenHeight, 0, 10_000),
      viewportWidth: number(device.viewportWidth, 0, 10_000), viewportHeight: number(device.viewportHeight, 0, 10_000),
      pixelRatio: number(device.pixelRatio, 0, 10), colorDepth: number(device.colorDepth, 0, 64),
      timezone: text(device.timezone, 80), language: text(device.language, 40),
      languages: Array.isArray(device.languages) ? device.languages.map((item) => text(item, 40)).filter(Boolean).slice(0, 6) : [],
      platform: text(device.platform, 80), vendor: text(device.vendor, 80), mobile: device.mobile === true,
      browserBrands: Array.isArray(device.browserBrands) ? device.browserBrands.slice(0, 5).map((item) => ({ brand: text(item?.brand, 50), version: text(item?.version, 20) })) : [],
      hardwareConcurrency: number(device.hardwareConcurrency, 0, 256),
      deviceMemory: number(device.deviceMemory, 0, 128), touchPoints: number(device.touchPoints, 0, 32),
      reducedMotion: device.reducedMotion === true, webdriver: device.webdriver === true,
      connection: text(device.connection, 20), graphicsVendor: text(device.graphicsVendor, 120),
      graphicsRenderer: text(device.graphicsRenderer, 180)
    },
    interaction: {
      mouseMoves: number(interaction.mouseMoves, 0, 100_000), mouseDistance: number(interaction.mouseDistance, 0, 10_000_000),
      clicks: number(interaction.clicks, 0, 10_000), keyPresses: number(interaction.keyPresses, 0, 100_000),
      scrollDepth: number(interaction.scrollDepth, 0, 100), loginAttempts: number(interaction.loginAttempts, 0, 1_000),
      activeMs: number(interaction.activeMs, 0, 86_400_000),
      heatmap: Array.isArray(interaction.heatmap) ? interaction.heatmap.slice(0, 9).map((item) => number(item, 0, 100_000)) : []
    }
  };
}

async function readTelemetry(request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_TELEMETRY_BYTES) return null;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_TELEMETRY_BYTES) return null;
    return normalizeTelemetry(JSON.parse(raw));
  } catch {
    return null;
  }
}

function eventBody(request, rateLimited, telemetry = null, honeypotDeviceId = "", autoBlockDevice = false) {
  const url = new URL(request.url);
  const cf = request.cf || {};
  const pagePath = telemetry?.pagePath?.startsWith("/") ? telemetry.pagePath : url.pathname;
  return JSON.stringify({
    source_ip: text(request.headers.get("cf-connecting-ip"), 80),
    country: text(cf.country, 80), region: text(cf.region, 100), city_approx: text(cf.city, 100),
    asn: cf.asn ? `AS${String(cf.asn).slice(0, 16)}` : "",
    isp_org: text(cf.asOrganization, 180),
    user_agent: text(request.headers.get("user-agent"), 700),
    client_hints: {
      platform: telemetry?.device?.platform || text(request.headers.get("sec-ch-ua-platform"), 80)
    },
    requested_host: text(url.hostname.toLowerCase(), 253),
    requested_path: text(pagePath, 300), method: text(request.method, 12),
    query_keys_without_sensitive_values: telemetry ? [] : [...url.searchParams.keys()].map((key) => text(key, 80)).slice(0, 30),
    referrer: text(request.headers.get("referer"), 500),
    cf_ray_id: text(request.headers.get("cf-ray"), 100),
    request_id: crypto.randomUUID(), rate_limited: rateLimited,
    honeypot_device_id: DEVICE_ID_PATTERN.test(honeypotDeviceId) ? honeypotDeviceId : "",
    auto_block_device: autoBlockDevice === true && DEVICE_ID_PATTERN.test(honeypotDeviceId),
    cloudflare_threat_score: Number.isFinite(Number(cf.threatScore)) ? Number(cf.threatScore) : null,
    ip_location: {
      latitude: Number.isFinite(Number(cf.latitude)) ? number(cf.latitude, -90, 90) : null,
      longitude: Number.isFinite(Number(cf.longitude)) ? number(cf.longitude, -180, 180) : null,
      postal_code: text(cf.postalCode, 30), continent: text(cf.continent, 10), metro_code: text(cf.metroCode, 20),
      accuracy: "ip_approximate"
    },
    telemetry
  });
}

async function postSigned(env, body) {
  if (!env.SECURITY_INGESTION_URL || !env.HONEYPOT_INGESTION_SECRET) throw new Error("honeypot ingestion is not configured");
  let responseValue;
  let networkError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const timestamp = Date.now().toString();
    const signature = await hmac(env.HONEYPOT_INGESTION_SECRET, `${timestamp}.${body}`);
    try {
      responseValue = await fetch(env.SECURITY_INGESTION_URL, {
        method: "POST",
        headers: { "content-type": "application/json", "x-renvix-timestamp": timestamp, "x-renvix-signature": signature },
        body
      });
      networkError = null;
    } catch (error) {
      networkError = error;
      continue;
    }
    if (responseValue.ok || (responseValue.status !== 429 && responseValue.status < 500)) break;
  }
  if (!responseValue && networkError) throw networkError;
  if (!responseValue?.ok) throw new Error(`security ingestion returned ${responseValue?.status || 0}`);
  return responseValue;
}

async function sendEvent(request, env, rateLimited, telemetry = null, honeypotDeviceId = "", autoBlockDevice = false) {
  return postSigned(env, eventBody(request, rateLimited, telemetry, honeypotDeviceId, autoBlockDevice));
}

async function endToEndProbe(env) {
  try {
    await postSigned(env, JSON.stringify({ internal_probe: true }));
    return emptyResponse(204);
  } catch (error) {
    console.error("HONEYPOT_INGESTION_PROBE_FAILED", String(error?.message || "unknown").slice(0, 160));
    return emptyResponse(503);
  }
}

async function rateLimit(request, env) {
  const sourceIp = text(request.headers.get("cf-connecting-ip"), 80) || "unknown";
  if (!env.HONEYPOT_RATE_LIMITER) return false;
  const outcome = await env.HONEYPOT_RATE_LIMITER.limit({ key: sourceIp });
  return !outcome.success;
}

function queueEvent(context, promise) {
  context.waitUntil(promise.catch((error) => {
    console.error("HONEYPOT_INGESTION_FAILED", String(error?.message || "unknown").slice(0, 160));
  }));
}

const worker = {
  async fetch(request, env, context) {
    const url = new URL(request.url);
    if (await isInternalProbe(request, env, url)) return endToEndProbe(env);
    const rateLimited = await rateLimit(request, env);
    const identity = await deviceIdentity(request, env);
    const internalRoute = url.pathname === HONEYPOT_SCRIPT_PATH
      || url.pathname === HONEYPOT_PIXEL_PATH
      || url.pathname === HONEYPOT_TELEMETRY_PATH;
    const block = identity.existing && !rateLimited && !internalRoute ? await checkDeviceBlock(env, identity.id) : null;
    if (identity.existing && !internalRoute) {
      return blockedResponse(block?.referenceId || `HP-${identity.id.slice(-12).toUpperCase()}`, identity.setCookies);
    }
    if (url.pathname === HONEYPOT_SCRIPT_PATH && request.method === "GET") return scriptResponse(identity.setCookies);
    if (url.pathname === HONEYPOT_PIXEL_PATH && request.method === "GET") return pixelResponse(identity.setCookies);

    if (url.pathname === HONEYPOT_TELEMETRY_PATH && request.method === "POST") {
      const origin = request.headers.get("origin");
      const telemetry = (!origin || origin === url.origin) ? await readTelemetry(request) : null;
      if (telemetry && !rateLimited) queueEvent(context, sendEvent(request, env, false, telemetry, identity.id));
      return emptyResponse(204, identity.setCookies);
    }

    if (!rateLimited) queueEvent(context, sendEvent(request, env, false, null, identity.id, true));
    return pageResponse(identity.setCookies);
  }
};

export default worker;
