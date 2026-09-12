const SESSION_COOKIES = ["renewpilot_session", "renvix_admin_session"];
const TRUSTED_DEVICE_COOKIE = "__Host-rvx_trusted_browser";
const HONEYPOT_DEVICE_COOKIE = "renvix_honeypot_device";
const HONEYPOT_DEVICE_PATTERN = /^hpd_[a-f0-9]{32}$/;
const CACHE_TTL_MS = 5000;
const CACHE_MAX = 1000;
const decisionCache = new Map();

function hex(bytes) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value) {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value))));
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

function hexBytes(value) {
  if (!/^[a-f0-9]{64}$/.test(value)) return null;
  return Uint8Array.from(value.match(/.{2}/g), (pair) => Number.parseInt(pair, 16));
}

async function verifiedHoneypotDeviceId(token, secret) {
  const value = String(token || "").slice(0, 180);
  const keyValue = String(secret || "");
  const separator = value.lastIndexOf(".");
  if (keyValue.length < 32 || separator <= 0) return "";
  const deviceId = value.slice(0, separator);
  const signature = hexBytes(value.slice(separator + 1));
  if (!HONEYPOT_DEVICE_PATTERN.test(deviceId) || !signature) return "";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(keyValue),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    signature,
    new TextEncoder().encode(`honeypot-device:${deviceId}`)
  );
  return valid ? deviceId : "";
}

function localHoneypotBlock(deviceId) {
  return deviceId
    ? { blocked: true, referenceId: `HP-${deviceId.slice(-12).toUpperCase()}` }
    : null;
}

function sourceIp(request) {
  return String(
    request.headers.get("cf-connecting-ip")
    || request.headers.get("x-real-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]
    || ""
  ).trim().slice(0, 80);
}

function cached(key) {
  const item = decisionCache.get(key);
  if (!item || item.expiresAt <= Date.now()) {
    decisionCache.delete(key);
    return null;
  }
  return item.value;
}

function remember(key, value) {
  if (decisionCache.size >= CACHE_MAX) decisionCache.delete(decisionCache.keys().next().value);
  decisionCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

export async function checkSecurityBlockAtBoundary(request, env = process.env) {
  const secret = String(env.SECURITY_BLOCK_CHECK_SECRET || "");
  const sessions = SESSION_COOKIES.map((name) => request.cookies.get(name)?.value).filter(Boolean);
  const sessionHashes = await Promise.all(sessions.map(sha256));
  const deviceToken = String(request.cookies.get(TRUSTED_DEVICE_COOKIE)?.value || "").slice(0, 256);
  const honeypotDeviceToken = String(request.cookies.get(HONEYPOT_DEVICE_COOKIE)?.value || "").slice(0, 180);
  const honeypotDeviceId = await verifiedHoneypotDeviceId(honeypotDeviceToken, env.HONEYPOT_INGESTION_SECRET);
  const localBlock = localHoneypotBlock(honeypotDeviceId);
  if (secret.length < 32) return localBlock || { blocked: false, enforcement: "not_configured" };
  const url = new URL(request.url);
  const referrer = (() => {
    try {
      const value = new URL(String(request.headers.get("referer") || ""));
      return `${value.origin}${value.pathname}`.slice(0, 500);
    } catch {
      return "";
    }
  })();
  const payload = {
    sourceIp: sourceIp(request), sessionHashes, deviceToken, honeypotDeviceToken,
    requestedHost: url.hostname.toLowerCase().slice(0, 253),
    requestedPath: url.pathname.slice(0, 300),
    method: String(request.method || "GET").toUpperCase().slice(0, 12),
    referrer
  };
  const cacheKey = await sha256(JSON.stringify(payload));
  const hit = cached(cacheKey);
  if (hit) return hit;

  const timestamp = String(Date.now());
  const rawBody = JSON.stringify(payload);
  const signature = await hmac(secret, `${timestamp}.${rawBody}`);
  const configured = String(env.SECURITY_BLOCK_CHECK_URL || "").trim();
  const apiOrigin = String(env.NEXT_PUBLIC_API_BASE_URL || env.API_PUBLIC_URL || "").trim();
  const endpoint = configured || (apiOrigin
    ? new URL("/api/security/block-check", apiOrigin).toString()
    : new URL("/api/security/block-check", request.url).toString());
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-security-timestamp": timestamp,
        "x-security-signature": signature
      },
      body: rawBody,
      cache: "no-store",
      signal: AbortSignal.timeout(1200)
    });
    if (!response.ok) return localBlock || { blocked: false, enforcement: "unavailable" };
    const result = await response.json();
    const decision = result?.blocked
      ? { blocked: true, referenceId: String(result.referenceId || "SEC-UNKNOWN").slice(0, 40) }
      : localBlock || { blocked: false, enforcement: "active" };
    remember(cacheKey, decision);
    return decision;
  } catch {
    // Fail open to avoid turning an internal lookup outage into a platform outage.
    // A locally verified honeypot marker is already definitive evidence and
    // remains fail-closed without depending on the central lookup latency.
    return localBlock || { blocked: false, enforcement: "unavailable" };
  }
}

export function neutralSecurityBlockResponse(referenceId, apiRequest = false) {
  const reference = String(referenceId || "SEC-UNKNOWN").replace(/[^A-Z0-9-]/gi, "").slice(0, 40);
  const headers = {
    "Cache-Control": "private, no-store, max-age=0",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow"
  };
  if (apiRequest) {
    return new Response(JSON.stringify({ ok: false, reason: "access_unavailable", referenceId: reference }), {
      status: 403,
      headers: { ...headers, "content-type": "application/json; charset=utf-8" }
    });
  }
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>تم حظر الوصول</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:linear-gradient(145deg,#eef6f4,#dfecea);color:#062b28;font-family:Tahoma,Arial,sans-serif}.card{width:min(100%,520px);padding:42px 36px;border:1px solid #d4e4e1;border-radius:24px;background:#fff;box-shadow:0 24px 70px #103f381f;text-align:center}.icon{width:70px;height:70px;margin:0 auto 22px;display:grid;place-items:center;border-radius:50%;background:#fff1f0;color:#b42318;font-size:32px}h1{font-size:28px;margin:0 0 12px}p{color:#526b68;line-height:1.9}.ref{margin:24px 0;padding:13px;border-radius:10px;background:#f3f7f6;direction:ltr;font:700 13px monospace}a{display:inline-flex;min-height:46px;align-items:center;justify-content:center;padding:0 24px;border-radius:11px;background:#0b5650;color:#fff;text-decoration:none;font-weight:800}</style></head><body><main class="card"><div class="icon" aria-hidden="true">!</div><h1>تم حظر الوصول</h1><p>تم حظر هذا الجهاز من استخدام خدمات Renvix وفق سياسة الحماية. إذا كنت تعتقد أن الإجراء حدث بالخطأ، راجع الدعم واذكر الرقم المرجعي.</p><div class="ref">REF: ${reference}</div><a href="mailto:support@renvix.app?subject=Security%20block%20review">مراجعة الحظر مع الدعم</a></main></body></html>`;
  return new Response(html, { status: 403, headers: { ...headers, "content-type": "text/html; charset=utf-8" } });
}
