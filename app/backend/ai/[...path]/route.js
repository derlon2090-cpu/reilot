const HOP_BY_HOP_HEADERS = new Set([
  "connection", "content-encoding", "content-length", "host", "keep-alive",
  "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade"
]);

function normalizedOrigin(value) {
  try { return new URL(String(value || "").trim()).origin; } catch { return ""; }
}

export function trustedFrontendRequest(request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const browserOrigin = normalizedOrigin(origin);
  const trustedOrigins = new Set([
    normalizedOrigin(request.url),
    "https://renvix.app",
    "https://www.renvix.app",
    "https://reilot.vercel.app",
    normalizedOrigin(process.env.APP_URL),
    normalizedOrigin(process.env.NEXT_PUBLIC_APP_URL)
  ].filter(Boolean));
  return trustedOrigins.has(browserOrigin);
}

export function backendOrigin() {
  const value = normalizedOrigin(process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_PUBLIC_URL || "https://api.renvix.app");
  if (!value || (process.env.NODE_ENV === "production" && !value.startsWith("https://"))) {
    throw new Error("AI backend origin is not configured securely.");
  }
  return value;
}

function backendHeaders(request) {
  const headers = new Headers(request.headers);
  for (const name of ["host", "content-length", "connection", "origin", "referer", "x-forwarded-host", "x-forwarded-proto"]) {
    headers.delete(name);
  }
  headers.set("Cache-Control", "no-store");
  headers.set("X-Renvix-Frontend-Gateway", "ai");
  return headers;
}

function responseHeaders(source) {
  const headers = new Headers();
  source.forEach((value, name) => {
    if (!HOP_BY_HOP_HEADERS.has(name.toLowerCase()) && name.toLowerCase() !== "set-cookie") headers.append(name, value);
  });
  headers.set("Cache-Control", "no-store");
  return headers;
}

const TRANSIENT_READ_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const DEFAULT_READ_RETRY_DELAYS = [0, 500, 1500, 3000];
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function proxyAIBackendRequest(request, { params }, fetchImpl = fetch, {
  sleepImpl = wait,
  retryDelays = DEFAULT_READ_RETRY_DELAYS
} = {}) {
  if (!trustedFrontendRequest(request)) {
    return Response.json({ ok: false, message: "طلب غير صالح." }, { status: 403 });
  }
  const { path = [] } = await params;
  const safePath = path.map((segment) => encodeURIComponent(String(segment))).join("/");
  const incomingUrl = new URL(request.url);
  const target = new URL(`/api/ai/${safePath}${incomingUrl.search}`, backendOrigin());
  const method = request.method.toUpperCase();
  const body = method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer();
  const canRetry = method === "GET" || method === "HEAD";
  const delays = canRetry && Array.isArray(retryDelays) && retryDelays.length ? retryDelays : [0];
  for (let attempt = 0; attempt < delays.length; attempt += 1) {
    if (attempt > 0) await sleepImpl(Math.max(0, Number(delays[attempt] || 0)));
    try {
      const backendResponse = await fetchImpl(target, {
        method,
        headers: backendHeaders(request),
        body,
        cache: "no-store",
        redirect: "manual",
        signal: request.signal
      });
      if (attempt < delays.length - 1 && TRANSIENT_READ_STATUSES.has(backendResponse.status)) {
        await backendResponse.body?.cancel().catch(() => {});
        continue;
      }
      return new Response(method === "HEAD" ? null : backendResponse.body, {
        status: backendResponse.status,
        statusText: backendResponse.statusText,
        headers: responseHeaders(backendResponse.headers)
      });
    } catch {
      if (attempt < delays.length - 1 && !request.signal.aborted) continue;
    }
  }
  return Response.json({ ok: false, message: "خادم الذكاء غير متاح مؤقتًا." }, {
    status: 503,
    headers: { "Cache-Control": "no-store", "Retry-After": "3" }
  });
}

export const GET = proxyAIBackendRequest;
export const POST = proxyAIBackendRequest;
export const PUT = proxyAIBackendRequest;
export const PATCH = proxyAIBackendRequest;
export const DELETE = proxyAIBackendRequest;
