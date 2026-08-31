import { NextResponse } from "next/server";
import {
  configuredAuthApiOrigin,
  configuredOrigins,
  canonicalAuthPath,
  hostnameFromHeaders,
  isAdminApiPath,
  isAdminAuthBridgeApi,
  isAdminPagePath,
  isAdminVerificationPagePath,
  isDashboardPagePath,
  isDashboardAuthApi,
  isAuthPath,
  isProtectedAppPath,
  isSplitHostEnabled,
  platformHostKind,
  safeReturnTo,
  shouldProxyAuthApi
} from "./src/shared/auth-portal.js";
import { proxyAuthBackendRequest } from "./src/shared/auth-backend-proxy.js";

export async function middleware(request) {
  const path = request.nextUrl.pathname;
  const hasCustomerSession = Boolean(request.cookies.get("renewpilot_session")?.value);
  const hasAdminSession = Boolean(request.cookies.get("renvix_admin_session")?.value);
  const origins = configuredOrigins();
  const splitHosts = isSplitHostEnabled(origins);
  const requestHost = hostnameFromHeaders(request.headers);
  const hostKind = platformHostKind(requestHost, origins);
  const authApiOrigin = configuredAuthApiOrigin();
  const isSetupPage = path === "/admin/setup";
  const isSetupApi = path.startsWith("/api/admin/setup/");
  const adminPage = isAdminPagePath(path);
  const adminApi = isAdminApiPath(path);
  const dashboardPage = isDashboardPagePath(path);
  const canonicalAuth = canonicalAuthPath(path);
  const authPage = isAuthPath(canonicalAuth) || path.startsWith("/auth/");
  const authApi = path.startsWith("/api/auth/");
  const pageRequest = !path.startsWith("/api/") && !path.startsWith("/backend/");

  if (splitHosts) {
    if (adminPage && hostKind !== "admin") return portalRedirect(request, origins.admin, path);
    if (adminApi && hostKind !== "admin" && hostKind !== "unknown") return wrongHostApiResponse();

    if (dashboardPage && hostKind !== "app") {
      return portalRedirect(request, origins.app, path);
    }
    if (authPage && !(hostKind === "admin" && isAdminVerificationPagePath(path)) && hostKind !== "auth") {
      return portalRedirect(request, origins.auth, canonicalAuth);
    }
    if (authApi
      && hostKind !== "auth"
      && !(hostKind === "app" && isDashboardAuthApi(path))
      && !(hostKind === "admin" && isAdminAuthBridgeApi(path))
      && hostKind !== "unknown") {
      return wrongHostApiResponse();
    }
    if (hostKind === "admin" && path.startsWith("/api/") && !adminApi && !(authApi && isAdminAuthBridgeApi(path))) {
      return wrongHostApiResponse();
    }

    if (hostKind === "app" && path === "/") {
      return hasCustomerSession
        ? portalRedirect(request, origins.app, "/dashboard")
        : portalRedirect(request, origins.auth, "/login");
    }
    if (hostKind === "auth" && path === "/") return portalRedirect(request, origins.auth, "/login");
    if (hostKind === "admin" && path === "/") return portalRedirect(request, origins.admin, "/admin");
    if (pageRequest && hostKind === "app" && !dashboardPage) return portalRedirect(request, origins.site, path);
    if (pageRequest && hostKind === "auth" && !authPage) return portalRedirect(request, origins.site, path);
    if (pageRequest && hostKind === "admin" && !adminPage && !isAdminVerificationPagePath(path)) {
      return portalRedirect(request, origins.site, path);
    }
  }

  if (shouldProxyAuthApi(path, requestHost, authApiOrigin)) {
    const target = new URL(`${path}${request.nextUrl.search}`, authApiOrigin);
    const response = await proxyAuthBackendRequest(request, target.origin);
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  }
  if (isSetupPage || isSetupApi) return secureNext();
  if (path.startsWith("/admin") && !hasAdminSession) return secureRedirect(new URL("/advanced-pro-control", origins.admin));
  if (adminApi && !path.startsWith("/api/admin/auth/") && !path.endsWith("/login") && !hasAdminSession) {
    return NextResponse.json({ ok: false, reason: "admin_auth_required" }, { status: 401 });
  }
  if (isProtectedAppPath(path) && !hasCustomerSession) {
    const login = new URL("/login", origins.auth);
    login.searchParams.set("returnTo", safeReturnTo(`${path}${request.nextUrl.search}`));
    return secureRedirect(login);
  }
  return NextResponse.next();
}

function portalRedirect(request, origin, pathname) {
  const target = new URL(pathname, origin);
  target.search = request.nextUrl.search;
  if (target.searchParams.has("returnTo")) target.searchParams.set("returnTo", safeReturnTo(target.searchParams.get("returnTo")));
  return secureRedirect(target);
}

function secureRedirect(target) {
  const response = NextResponse.redirect(target, 307);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

function secureNext() {
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

function wrongHostApiResponse() {
  return NextResponse.json(
    { ok: false, reason: "misdirected_host" },
    { status: 404, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } }
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|app/|assets/|data/).*)"]
};
