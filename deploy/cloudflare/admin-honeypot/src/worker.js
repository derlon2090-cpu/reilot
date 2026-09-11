import {
  HONEYPOT_HTML, HONEYPOT_SCRIPT, HONEYPOT_SCRIPT_PATH, HONEYPOT_TELEMETRY_PATH
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

const HTML_CSP = "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; img-src data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";
const SCRIPT_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";
const MAX_TELEMETRY_BYTES = 12_288;

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

function response(body, status, contentType, csp = SCRIPT_CSP) {
  return new Response(body, {
    status,
    headers: { ...BASE_HEADERS, "content-type": contentType, "content-security-policy": csp }
  });
}

function emptyResponse(status = 204) {
  return response(null, status, "text/plain; charset=utf-8");
}

function pageResponse() {
  return response(HONEYPOT_HTML, 200, "text/html; charset=utf-8", HTML_CSP);
}

function scriptResponse() {
  return response(HONEYPOT_SCRIPT, 200, "application/javascript; charset=utf-8");
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
      platform: text(device.platform, 80), hardwareConcurrency: number(device.hardwareConcurrency, 0, 256),
      deviceMemory: number(device.deviceMemory, 0, 128), touchPoints: number(device.touchPoints, 0, 32),
      reducedMotion: device.reducedMotion === true, webdriver: device.webdriver === true,
      connection: text(device.connection, 20)
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

function eventBody(request, rateLimited, telemetry = null) {
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
    requested_path: text(pagePath, 300), method: text(request.method, 12),
    query_keys_without_sensitive_values: telemetry ? [] : [...url.searchParams.keys()].map((key) => text(key, 80)).slice(0, 30),
    referrer: text(request.headers.get("referer"), 500),
    cf_ray_id: text(request.headers.get("cf-ray"), 100),
    request_id: crypto.randomUUID(), rate_limited: rateLimited,
    cloudflare_threat_score: Number.isFinite(Number(cf.threatScore)) ? Number(cf.threatScore) : null,
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

async function sendEvent(request, env, rateLimited, telemetry = null) {
  return postSigned(env, eventBody(request, rateLimited, telemetry));
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
    if (url.pathname === HONEYPOT_SCRIPT_PATH && request.method === "GET") return scriptResponse();

    const rateLimited = await rateLimit(request, env);
    if (url.pathname === HONEYPOT_TELEMETRY_PATH && request.method === "POST") {
      const origin = request.headers.get("origin");
      const telemetry = (!origin || origin === url.origin) ? await readTelemetry(request) : null;
      if (telemetry && !rateLimited) queueEvent(context, sendEvent(request, env, false, telemetry));
      return emptyResponse(204);
    }

    if (!rateLimited) queueEvent(context, sendEvent(request, env, false));
    return pageResponse();
  }
};

export default worker;
