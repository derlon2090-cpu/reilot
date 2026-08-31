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
const LOCAL_ORIGIN = "http://localhost:3000";
const ADMIN_AUTH_PAGE_SET = new Set(["/verify-email", "/verify-mfa", "/auth/verify-email", "/auth/verify-mfa"]);
const ADMIN_AUTH_API_SET = new Set([
  "/api/auth/email-otp/status",
  "/api/auth/email-otp/verify",
  "/api/auth/email-otp/resend",
  "/api/auth/mfa/status",
  "/api/auth/mfa/verify",
  "/api/auth/logout"
]);
const DASHBOARD_AUTH_API_SET = new Set(["/api/auth/session", "/api/auth/logout"]);

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
  try { parsed = new URL(candidate, "https://relative.invalid"); } catch { return fallback; }
  if (parsed.origin !== "https://relative.invalid" || isAuthPath(parsed.pathname) || parsed.pathname.startsWith("/auth/")) return fallback;
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function configuredOrigins(env = process.env) {
  const production = env.NODE_ENV === "production";
  const app = platformOrigin(env.NEXT_PUBLIC_APP_URL || env.APP_URL, "NEXT_PUBLIC_APP_URL", production);
  const auth = platformOrigin(env.NEXT_PUBLIC_AUTH_URL || env.AUTH_URL || env.BETTER_AUTH_URL, "NEXT_PUBLIC_AUTH_URL", production);
  const admin = platformOrigin(env.NEXT_PUBLIC_ADMIN_URL || env.ADMIN_URL, "NEXT_PUBLIC_ADMIN_URL", production);
  const site = platformOrigin(env.NEXT_PUBLIC_SITE_URL || env.SITE_URL, "NEXT_PUBLIC_SITE_URL", production);
  return { site, auth, app, admin };
}

export function isAdminPagePath(pathname) {
  const path = String(pathname || "/");
  return path === "/admin" || path.startsWith("/admin/") || path === "/advanced-pro-control" || path.startsWith("/advanced-pro-control/");
}

export function isAdminApiPath(pathname) {
  const path = String(pathname || "/");
  return path === "/api/admin" || path.startsWith("/api/admin/");
}

export function isDashboardPagePath(pathname) {
  return isProtectedAppPath(pathname);
}

export function isAdminVerificationPagePath(pathname) {
  return ADMIN_AUTH_PAGE_SET.has(String(pathname || ""));
}

export function isAdminAuthBridgeApi(pathname) {
  return ADMIN_AUTH_API_SET.has(String(pathname || ""));
}

export function isDashboardAuthApi(pathname) {
  return DASHBOARD_AUTH_API_SET.has(String(pathname || ""));
}

export function platformHostKind(hostname, origins) {
  const host = String(hostname || "").toLowerCase();
  if (host === new URL(origins.app).hostname.toLowerCase()) return "app";
  if (host === new URL(origins.auth).hostname.toLowerCase()) return "auth";
  if (host === new URL(origins.admin).hostname.toLowerCase()) return "admin";
  if (host === new URL(origins.site).hostname.toLowerCase()) return "site";
  return "unknown";
}

export function configuredAuthApiOrigin(env = process.env) {
  const candidate = String(env.NEXT_PUBLIC_API_BASE_URL || env.API_PUBLIC_URL || "").trim();
  if (!candidate) return "";
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && env.NODE_ENV === "production") return "";
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return "";
    return url.origin;
  } catch {
    return "";
  }
}

export function shouldProxyAuthApi(pathname, requestHost, apiOrigin, env = process.env) {
  const path = String(pathname || "");
  if (env.NODE_ENV !== "production" || !path.startsWith("/api/auth/")) return false;
  if (!apiOrigin) return false;
  try {
    return new URL(apiOrigin).hostname.toLowerCase() !== String(requestHost || "").toLowerCase();
  } catch {
    return false;
  }
}

export function hostnameFromHeaders(headers) {
  const forwarded = headers.get("x-forwarded-host") || headers.get("host") || "";
  return String(forwarded).split(",")[0].trim().replace(/:\d+$/, "").toLowerCase();
}

export function isSplitHostEnabled(origins) {
  const hosts = [origins.site, origins.auth, origins.app, origins.admin].map((origin) => new URL(origin).hostname);
  return new Set(hosts).size > 1 && !hosts.some((host) => ["localhost", "127.0.0.1", "::1"].includes(host));
}

function platformOrigin(value, variableName, production) {
  if (!String(value || "").trim() && production) throw new Error(`${variableName} is required in production`);
  let parsed;
  try { parsed = new URL(String(value || LOCAL_ORIGIN).trim()); } catch { throw new Error(`${variableName} is invalid`); }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error(`${variableName} is unsafe`);
  if (production && parsed.protocol !== "https:") throw new Error(`${variableName} must use HTTPS in production`);
  if (production && (parsed.hostname.endsWith(".vercel.app") || ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname))) {
    throw new Error(`${variableName} must use its canonical production domain`);
  }
  return parsed.origin;
}
