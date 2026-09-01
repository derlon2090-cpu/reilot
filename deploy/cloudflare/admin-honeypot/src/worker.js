const NEUTRAL_HEADERS = Object.freeze({
  "cache-control": "no-store, max-age=0",
  "content-type": "text/plain; charset=utf-8",
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  "cross-origin-resource-policy": "same-origin",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "x-robots-tag": "noindex, nofollow, noarchive"
});

function text(value, max) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, "").slice(0, max);
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

function neutralResponse(status = 404) {
  return new Response(status === 204 ? null : "", { status, headers: NEUTRAL_HEADERS });
}

async function sendEvent(request, env, rateLimited) {
  const url = new URL(request.url);
  const cf = request.cf || {};
  const body = JSON.stringify({
    source_ip: text(request.headers.get("cf-connecting-ip"), 80),
    country: text(cf.country, 80), region: text(cf.region, 100), city_approx: text(cf.city, 100),
    asn: cf.asn ? `AS${String(cf.asn).slice(0, 16)}` : "",
    isp_org: text(cf.asOrganization, 180),
    user_agent: text(request.headers.get("user-agent"), 700),
    client_hints: { platform: text(request.headers.get("sec-ch-ua-platform"), 80) },
    requested_path: text(url.pathname, 300), method: text(request.method, 12),
    query_keys_without_sensitive_values: [...url.searchParams.keys()].map((key) => text(key, 80)).slice(0, 30),
    referrer: text(request.headers.get("referer"), 500),
    cf_ray_id: text(request.headers.get("cf-ray"), 100),
    request_id: crypto.randomUUID(), rate_limited: rateLimited,
    cloudflare_threat_score: Number.isFinite(Number(cf.threatScore)) ? Number(cf.threatScore) : null
  });
  const timestamp = Date.now().toString();
  const signature = await hmac(env.HONEYPOT_INGESTION_SECRET, `${timestamp}.${body}`);
  const response = await fetch(env.SECURITY_INGESTION_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-renvix-timestamp": timestamp, "x-renvix-signature": signature },
    body
  });
  if (!response.ok) throw new Error(`security ingestion returned ${response.status}`);
}

const worker = {
  async fetch(request, env, context) {
    const url = new URL(request.url);
    if (await isInternalProbe(request, env, url)) return neutralResponse(204);
    if (!env.SECURITY_INGESTION_URL || !env.HONEYPOT_INGESTION_SECRET) return neutralResponse(404);
    const sourceIp = text(request.headers.get("cf-connecting-ip"), 80) || "unknown";
    let rateLimited = false;
    if (env.HONEYPOT_RATE_LIMITER) {
      const outcome = await env.HONEYPOT_RATE_LIMITER.limit({ key: sourceIp });
      rateLimited = !outcome.success;
    }
    context.waitUntil(sendEvent(request, env, rateLimited).catch(() => undefined));
    // Keep the observable response identical for every path and attempt. The
    // rate-limit signal is recorded server-side without becoming an oracle.
    return neutralResponse(404);
  }
};

export default worker;
