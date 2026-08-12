export const AUTH_PATHS = Object.freeze([
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/verify-mfa",
  "/recovery"
]);

export const LEGACY_AUTH_PATHS = Object.freeze({
  "/auth/verify-email": "/verify-email",
  "/auth/verify-mfa": "/verify-mfa"
});

const AUTH_PATH_SET = new Set(AUTH_PATHS);

export function canonicalAuthPath(pathname) {
  const path = String(pathname || "/").replace(/\/{2,}/g, "/");
  return LEGACY_AUTH_PATHS[path] || path;
}

export function isAuthPath(pathname) {
  return AUTH_PATH_SET.has(canonicalAuthPath(pathname));
}

export function isProtectedAppPath(pathname) {
  const path = String(pathname || "/");
  return path === "/dashboard" || path.startsWith("/dashboard/");
}

export function safeReturnTo(value, fallback = "/dashboard") {
  const candidate = String(value || "").trim();
  if (!candidate || candidate.length > 2048 || !candidate.startsWith("/") || candidate.startsWith("//")) return fallback;
  let parsed;
  try { parsed = new URL(candidate, "https://renvix.app"); } catch { return fallback; }
  if (parsed.origin !== "https://renvix.app" || isAuthPath(parsed.pathname) || parsed.pathname.startsWith("/auth/")) return fallback;
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function configuredOrigins(env = process.env) {
  const app = safeOrigin(env.APP_URL || env.NEXT_PUBLIC_APP_URL, env.NODE_ENV === "production" ? "https://renvix.app" : "http://localhost:3000");
  const auth = safeOrigin(env.AUTH_URL, env.NODE_ENV === "production" ? "https://accounts.renvix.app" : app);
  return { app, auth };
}

export function hostnameFromHeaders(headers) {
  const forwarded = headers.get("x-forwarded-host") || headers.get("host") || "";
  return String(forwarded).split(",")[0].trim().replace(/:\d+$/, "").toLowerCase();
}

export function isSplitHostEnabled(origins) {
  const appHost = new URL(origins.app).hostname;
  const authHost = new URL(origins.auth).hostname;
  return appHost !== authHost && ![appHost, authHost].some((host) => host === "localhost" || host === "127.0.0.1");
}

function safeOrigin(value, fallback) {
  let parsed;
  try { parsed = new URL(String(value || fallback).trim()); } catch { parsed = new URL(fallback); }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) return new URL(fallback).origin;
  return parsed.origin;
}
