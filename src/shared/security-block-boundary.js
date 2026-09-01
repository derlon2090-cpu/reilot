const SESSION_COOKIES = ["renewpilot_session", "renvix_admin_session"];
const TRUSTED_DEVICE_COOKIE = "__Host-rvx_trusted_browser";
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
  if (secret.length < 32) return { blocked: false, enforcement: "not_configured" };
  const sessions = SESSION_COOKIES.map((name) => request.cookies.get(name)?.value).filter(Boolean);
  const sessionHashes = await Promise.all(sessions.map(sha256));
  const deviceToken = String(request.cookies.get(TRUSTED_DEVICE_COOKIE)?.value || "").slice(0, 256);
  const payload = { sourceIp: sourceIp(request), sessionHashes, deviceToken };
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
    if (!response.ok) return { blocked: false, enforcement: "unavailable" };
    const result = await response.json();
    const decision = result?.blocked
      ? { blocked: true, referenceId: String(result.referenceId || "SEC-UNKNOWN").slice(0, 40) }
      : { blocked: false, enforcement: "active" };
    remember(cacheKey, decision);
    return decision;
  } catch {
    // Fail open to avoid turning an internal lookup outage into a platform outage.
    return { blocked: false, enforcement: "unavailable" };
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
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>تعذر الوصول</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f3f8f7;color:#062b28;font-family:Arial,sans-serif}.card{width:min(88vw,520px);padding:36px;border:1px solid #dce9e7;border-radius:18px;background:#fff;box-shadow:0 18px 50px #062b2814}h1{font-size:25px;margin:0 0 12px}p{color:#526b68;line-height:1.8}.ref{direction:ltr;text-align:right;font:600 13px monospace;color:#78908d}</style></head><body><main class="card"><h1>تعذر الوصول إلى هذه الصفحة حاليًا.</h1><p>إذا كنت تعتقد أن هذا خطأ، تواصل مع الدعم.</p><div class="ref">REF: ${reference}</div></main></body></html>`;
  return new Response(html, { status: 403, headers: { ...headers, "content-type": "text/html; charset=utf-8" } });
}
