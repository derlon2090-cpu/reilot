const AUTH_READINESS_PATH = "/api/auth/readiness";
const LEGACY_READINESS_PATH = "/api/auth/google/config";
const READY_CACHE_MS = 45_000;
const WARMUP_DELAYS_MS = Object.freeze([0, 400, 800, 1_400, 2_200, 3_200, 4_000]);
const TRANSIENT_STATUSES = new Set([502, 503, 504]);
const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade"
]);

let backendReadyUntil = 0;
let backendWarmupPromise = null;

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function requestAcceptsHtml(request) {
  const mode = String(request.headers.get("sec-fetch-mode") || "").toLowerCase();
  const destination = String(request.headers.get("sec-fetch-dest") || "").toLowerCase();
  const accept = String(request.headers.get("accept") || "").toLowerCase();
  return mode === "navigate" || destination === "document" || accept.includes("text/html");
}

function backendHeaders(request) {
  const headers = new Headers(request.headers);
  [
    "host",
    "content-length",
    "connection",
    "x-forwarded-host",
    // Cloudflare Access is enforced at the Vercel admin boundary. Render keeps
    // its independent Renvix authentication and must never depend on this JWT.
    "cf-access-jwt-assertion"
  ].forEach((name) => headers.delete(name));
  headers.set("Cache-Control", "no-store");
  headers.set("X-Renvix-Auth-Gateway", "accounts");
  return headers;
}

function splitCombinedSetCookie(value) {
  if (!value) return [];
  return value.split(/,\s*(?=[^;,=\s]+=[^;,]*)/g).map((item) => item.trim()).filter(Boolean);
}

export function responseSetCookies(headers) {
  if (typeof headers.getSetCookie === "function") {
    const cookies = headers.getSetCookie();
    if (cookies.length) return cookies;
  }
  return splitCombinedSetCookie(headers.get("set-cookie"));
}

function copiedResponseHeaders(source) {
  const headers = new Headers();
  source.forEach((value, name) => {
    const normalized = name.toLowerCase();
    if (normalized !== "set-cookie" && !HOP_BY_HOP_HEADERS.has(normalized)) headers.append(name, value);
  });
  responseSetCookies(source).forEach((cookie) => headers.append("Set-Cookie", cookie));
  headers.set("Cache-Control", "no-store");
  headers.set("X-Renvix-Auth-Gateway", "accounts");
  return headers;
}

function isRenderHoldingPage(response, bodyText) {
  if (!String(response.headers.get("content-type") || "").toLowerCase().includes("text/html")) return false;
  return /service\s+waking\s+up|incoming\s+http\s+request|allocating\s+compute\s+resources|render\.com|render/i.test(bodyText);
}

async function readinessProbe(path, apiOrigin, fetcher) {
  const response = await fetcher(new URL(path, apiOrigin), {
    method: "GET",
    headers: { Accept: "application/json", "Cache-Control": "no-store", "X-Renvix-Auth-Gateway": "warmup" },
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(2_000)
  });
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (!contentType.includes("application/json")) return { ready: false, missing: response.status === 404 || response.status === 200 };
  const payload = await response.json().catch(() => null);
  if (path === AUTH_READINESS_PATH) {
    return { ready: payload?.ok === true && payload?.service === "renvix-auth", missing: payload?.service !== "renvix-auth" };
  }
  return { ready: Boolean(payload && typeof payload === "object"), missing: false };
}

async function readinessAttempt(apiOrigin, fetcher) {
  const primary = await readinessProbe(AUTH_READINESS_PATH, apiOrigin, fetcher);
  if (primary.ready) return true;
  // During a rolling deploy, Vercel can receive the gateway before Render has
  // the dedicated readiness route. A known lightweight JSON route proves the
  // old backend process is awake without exposing its holding page.
  if (primary.missing) {
    const legacy = await readinessProbe(LEGACY_READINESS_PATH, apiOrigin, fetcher);
    return legacy.ready;
  }
  return false;
}

export async function ensureAuthBackendReady(apiOrigin, { fetcher = fetch, now = Date.now } = {}) {
  if (backendReadyUntil > now()) return true;
  if (backendWarmupPromise) return backendWarmupPromise;

  backendWarmupPromise = (async () => {
    for (const delay of WARMUP_DELAYS_MS) {
      if (delay) await sleep(delay);
      try {
        if (await readinessAttempt(apiOrigin, fetcher)) {
          backendReadyUntil = now() + READY_CACHE_MS;
          return true;
        }
      } catch {
        // Render can close or replace the first request while a sleeping service starts.
      }
    }
    return false;
  })().finally(() => {
    backendWarmupPromise = null;
  });

  return backendWarmupPromise;
}

export function resetAuthBackendReadinessForTests() {
  backendReadyUntil = 0;
  backendWarmupPromise = null;
}

function warmingDocument(request) {
  const retryTarget = new URL(request.url);
  retryTarget.searchParams.set("auth_retry", String(Date.now()));
  const safeTarget = retryTarget.pathname + retryTarget.search;
  const html = `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="3;url=${safeTarget.replaceAll("&", "&amp;").replaceAll('"', "&quot;")}">
<title>جاري تجهيز تسجيل الدخول | Renvix</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f7fbfa;color:#0a4f49;font-family:Tahoma,Arial,sans-serif}.card{width:min(88vw,430px);padding:42px 30px;text-align:center;background:#fff;border:1px solid #dceae7;border-radius:24px;box-shadow:0 18px 50px rgba(8,79,73,.1)}.mark{font-size:42px;font-weight:800;letter-spacing:.5px}.spinner{width:34px;height:34px;margin:25px auto;border:3px solid #dceae7;border-top-color:#08766d;border-radius:50%;animation:spin .8s linear infinite}h1{font-size:22px;margin:0 0 10px}p{color:#60736f;line-height:1.8;margin:0}@keyframes spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.spinner{animation:none;border-top-color:#dceae7}}</style></head>
<body><main class="card"><div class="mark">Renvix</div><div class="spinner" aria-hidden="true"></div><h1>جاري تجهيز تسجيل الدخول الآمن</h1><p>سنكمل تلقائيًا خلال لحظات، ولا تحتاج إلى تحديث الصفحة.</p></main></body></html>`;
  return new Response(html, {
    status: 503,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8",
      "Retry-After": "3",
      "X-Renvix-Auth-Gateway": "warming"
    }
  });
}

export function authBackendWarmingResponse(request) {
  if (requestAcceptsHtml(request)) return warmingDocument(request);
  return Response.json(
    { ok: false, reason: "auth_backend_warming", retryAfter: 3 },
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": "3",
        "X-Renvix-Auth-Gateway": "warming"
      }
    }
  );
}

export async function proxyAuthBackendRequest(request, apiOrigin, { fetcher = fetch } = {}) {
  if (!(await ensureAuthBackendReady(apiOrigin, { fetcher }))) return authBackendWarmingResponse(request);

  const target = new URL(`${new URL(request.url).pathname}${new URL(request.url).search}`, apiOrigin);
  const method = request.method.toUpperCase();
  const body = method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer();
  let backendResponse;
  try {
    backendResponse = await fetcher(target, {
      method,
      headers: backendHeaders(request),
      body,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(25_000)
    });
  } catch {
    backendReadyUntil = 0;
    return authBackendWarmingResponse(request);
  }

  const responseBody = await backendResponse.arrayBuffer();
  const responseText = new TextDecoder().decode(responseBody.slice(0, 12_000));
  const contentType = String(backendResponse.headers.get("content-type") || "").toLowerCase();
  const infrastructureFailure = TRANSIENT_STATUSES.has(backendResponse.status) && !contentType.includes("application/json");
  if (infrastructureFailure || isRenderHoldingPage(backendResponse, responseText)) {
    backendReadyUntil = 0;
    return authBackendWarmingResponse(request);
  }

  const bodyForbidden = method === "HEAD" || [101, 204, 205, 304].includes(backendResponse.status);
  return new Response(bodyForbidden ? null : responseBody, {
    status: backendResponse.status,
    statusText: backendResponse.statusText,
    headers: copiedResponseHeaders(backendResponse.headers)
  });
}
