const HONEYPOT_HOST = "admin.renvix.app";
const MAX_EVENT_BYTES = 16_384;

function cleanText(value, max = 500) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
}

function cleanIp(value) {
  const candidate = cleanText(value, 80);
  return /^[0-9a-f:.]+$/i.test(candidate) ? candidate : "";
}

function referrerWithoutQuery(value) {
  try {
    const url = new URL(String(value || ""));
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return `${url.origin}${url.pathname}`.slice(0, 500);
  } catch {
    return "";
  }
}

async function hmac(secret, value) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function isAdminHoneypotHost(hostname) {
  return String(hostname || "").toLowerCase() === HONEYPOT_HOST;
}

export function adminHoneypotEvent(request) {
  const url = request.nextUrl || new URL(request.url);
  return {
    source_ip: cleanIp(request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip")),
    country: cleanText(request.headers.get("cf-ipcountry") || request.headers.get("x-vercel-ip-country"), 80),
    region: cleanText(request.headers.get("cf-region") || request.headers.get("x-vercel-ip-country-region"), 100),
    city_approx: cleanText(request.headers.get("cf-ipcity") || request.headers.get("x-vercel-ip-city"), 100),
    asn: cleanText(request.headers.get("cf-asn"), 80).replace(/[^0-9A-Za-z]/g, ""),
    isp_org: "",
    user_agent: cleanText(request.headers.get("user-agent"), 700),
    client_hints: { platform: cleanText(request.headers.get("sec-ch-ua-platform"), 80) },
    requested_path: cleanText(url.pathname || "/", 300) || "/",
    method: cleanText(request.method, 12).toUpperCase() || "GET",
    query_keys_without_sensitive_values: [],
    referrer: referrerWithoutQuery(request.headers.get("referer")),
    cf_ray_id: cleanText(request.headers.get("cf-ray"), 100),
    request_id: cleanText(request.headers.get("x-vercel-id") || request.headers.get("x-request-id"), 100),
    rate_limited: false,
    cloudflare_threat_score: null
  };
}

export async function recordAdminHoneypotRequest(request, env = process.env, fetcher = fetch) {
  const event = adminHoneypotEvent(request);
  console.warn("ADMIN_HONEYPOT_ACCESS", event);

  const secret = String(env.HONEYPOT_INGESTION_SECRET || "").trim();
  const apiOrigin = String(env.API_PUBLIC_URL || env.NEXT_PUBLIC_API_BASE_URL || "").trim();
  if (secret.length < 24 || !apiOrigin || !event.source_ip) {
    console.error("ADMIN_HONEYPOT_INGEST_UNAVAILABLE", { reason: "configuration_or_source_missing", requestId: event.request_id });
    return { ok: false, reason: "configuration_or_source_missing" };
  }

  let target;
  try {
    target = new URL("/api/security/ingest/honeypot", apiOrigin);
    if (env.NODE_ENV === "production" && target.protocol !== "https:") throw new Error("unsafe_ingest_origin");
  } catch {
    return { ok: false, reason: "configuration_invalid" };
  }

  const body = JSON.stringify(event);
  if (new TextEncoder().encode(body).byteLength > MAX_EVENT_BYTES) return { ok: false, reason: "event_too_large" };
  const timestamp = String(Date.now());
  const signature = await hmac(secret, `${timestamp}.${body}`);
  try {
    const response = await fetcher(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Renvix-Timestamp": timestamp,
        "X-Renvix-Signature": signature
      },
      body,
      cache: "no-store"
    });
    return response.ok ? { ok: true } : { ok: false, reason: "ingest_rejected" };
  } catch {
    return { ok: false, reason: "network_error" };
  }
}
