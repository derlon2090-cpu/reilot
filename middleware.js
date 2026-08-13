import { NextResponse } from "next/server";
import {
  canonicalAuthPath,
  configuredAuthApiOrigin,
  configuredOrigins,
  hostnameFromHeaders,
  isAuthPath,
  isProtectedAppPath,
  isSplitHostEnabled,
  safeReturnTo,
  shouldProxyAuthApi
} from "./src/shared/auth-portal.js";

export function middleware(request) {
  const path = request.nextUrl.pathname;
  const hasSession = Boolean(request.cookies.get("renewpilot_session")?.value);
  const origins = configuredOrigins();
  const splitHosts = isSplitHostEnabled(origins);
  const requestHost = hostnameFromHeaders(request.headers);
  const appHost = new URL(origins.app).hostname;
  const authHost = new URL(origins.auth).hostname;
  const authApiOrigin = configuredAuthApiOrigin();
  const isSetupPage = path === "/admin/setup";
  const isSetupApi = path.startsWith("/api/admin/setup/");

  if (isSetupPage || isSetupApi) return secureNext();
  if (shouldProxyAuthApi(path, requestHost, authApiOrigin)) {
    const target = new URL(`${path}${request.nextUrl.search}`, authApiOrigin);
    const response = NextResponse.rewrite(target);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  }
  if (path.startsWith("/admin") && !hasSession) return NextResponse.redirect(new URL("/advanced-pro-control", request.url));
  if (path.startsWith("/api/admin") && !path.startsWith("/api/admin/auth/") && !path.endsWith("/login") && !hasSession) {
    return NextResponse.json({ ok: false, reason: "admin_auth_required" }, { status: 401 });
  }

  if (splitHosts && requestHost === authHost) {
    if (path.startsWith("/api/auth/")) return secureNext();
    const canonical = canonicalAuthPath(path);
    if (canonical !== path) return portalRedirect(request, origins.auth, canonical);
    if (isAuthPath(canonical)) return secureNext();
    return portalRedirect(request, origins.app, path);
  }

  if (splitHosts && requestHost === appHost && isAuthPath(path)) {
    return portalRedirect(request, origins.auth, canonicalAuthPath(path));
  }

  if (splitHosts && requestHost === appHost && isProtectedAppPath(path) && !hasSession) {
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

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|app/|assets/|data/).*)"]
};
