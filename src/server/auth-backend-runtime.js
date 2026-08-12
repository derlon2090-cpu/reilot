function normalizedOrigin(value) {
  const candidate = String(value || "").trim();
  if (!candidate) return "";
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:")) return "";
    return url.origin;
  } catch {
    return "";
  }
}

export function publicAuthApiOrigin(env = process.env) {
  return normalizedOrigin(env.NEXT_PUBLIC_API_BASE_URL || env.API_PUBLIC_URL || env.RENDER_EXTERNAL_URL);
}

export function isVercelRuntime(env = process.env) {
  return Boolean(env.VERCEL || env.VERCEL_ENV || env.VERCEL_URL);
}

export function isRenderAuthRuntime(env = process.env) {
  if (env.NODE_ENV !== "production") return true;
  if (isVercelRuntime(env)) return false;
  return env.RENDER === "true" || Boolean(env.RENDER_SERVICE_ID || env.RENDER_EXTERNAL_URL) || env.AUTH_BACKEND_RUNTIME === "render";
}

export function authBackendUnavailableResponse() {
  return Response.json(
    { ok: false, reason: "auth_backend_required" },
    { status: 503, headers: { "Cache-Control": "no-store" } }
  );
}
