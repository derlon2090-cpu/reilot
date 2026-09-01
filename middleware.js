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
import { verifyCloudflareAccessRequest } from "./src/shared/cloudflare-access.js";
import { isAdminHoneypotHost, recordAdminHoneypotRequest } from "./src/shared/admin-honeypot.js";
import { checkSecurityBlockAtBoundary, neutralSecurityBlockResponse } from "./src/shared/security-block-boundary.js";

const STATIC_ASSET_PREFIXES = Object.freeze([
  "/_next/",
  "/assets/",
  "/app/",
  "/data/"
]);

export function isStaticAssetPath(pathname) {
  const path = String(pathname || "/");
  return path === "/favicon.ico"
    || STATIC_ASSET_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export async function middleware(request, event) {
  return middlewareRequest(request, {
    waitUntil: event?.waitUntil ? event.waitUntil.bind(event) : null
  });
}

export async function middlewareRequest(request, {
  verifyAccess = verifyCloudflareAccessRequest,
  recordHoneypot = recordAdminHoneypotRequest,
  waitUntil = null
} = {}) {
  const path = request.nextUrl.pathname;
  const directRequestHost = directHostname(request.headers);
  const requestHost = hostnameFromHeaders(request.headers);
  if (isAdminHoneypotHost(directRequestHost) || isAdminHoneypotHost(requestHost)) {
    const recording = Promise.resolve(recordHoneypot(request, process.env));
    if (waitUntil) waitUntil(recording);
    else void recording;
    return adminHoneypotResponse();
  }

  const internalBlockCheck = path === "/api/security/block-check";
  if (!internalBlockCheck) {
    const block = await checkSecurityBlockAtBoundary(request);
    if (block.blocked) return neutralSecurityBlockResponse(block.referenceId, path.startsWith("/api/") || path.startsWith("/backend/"));
  }
  // The matcher intentionally covers every path so the reserved honeypot host
  // can never bypass middleware. Once the honeypot and boundary block checks
  // have passed, static files must stay on the requested deployment origin.
  if (isStaticAssetPath(path)) return staticAssetNext(request);

  const hasCustomerSession = Boolean(request.cookies.get("renewpilot_session")?.value);
  const hasAdminSession = Boolean(request.cookies.get("renvix_admin_session")?.value);
  const origins = configuredOrigins();
  const splitHosts = isSplitHostEnabled(origins);
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
  const apiHost = authApiOrigin ? new URL(authApiOrigin).hostname.toLowerCase() : "";
  const adminSurface = hostKind === "admin" && (
    path === "/"
    || adminPage
    || adminApi
    || isAdminVerificationPagePath(path)
    || (authApi && isAdminAuthBridgeApi(path))
  );

  if (splitHosts) {
    if (adminPage && hostKind !== "admin") {
      logAdminBoundaryEvent(request, "admin_page_wrong_host", requestHost, path);
      return hostKind === "unknown"
        ? wrongHostPageResponse()
        : portalRedirect(request, origins.admin, path);
    }
    if (adminApi && hostKind !== "admin" && requestHost !== apiHost) {
      logAdminBoundaryEvent(request, "admin_api_wrong_host", requestHost, path);
      return wrongHostApiResponse();
    }

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

    // Cloudflare Access terminates at Vercel. Render remains protected by the
    // independent Renvix admin session/RBAC checks and must not require the CF JWT.
    if (adminSurface
      && process.env.NODE_ENV === "production"
      && directRequestHost === new URL(origins.admin).hostname.toLowerCase()) {
      const access = await verifyAccess(request, process.env);
      if (!access.ok) {
        logAdminBoundaryEvent(request, access.reason, requestHost, path);
        return cloudflareAccessResponse(access, adminApi || authApi);
      }
    }

    if (hostKind === "admin" && isAdminVerificationPagePath(path) && canonicalAuth !== path) {
      return portalRedirect(request, origins.admin, canonicalAuth);
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
  if (isSetupPage || isSetupApi) return secureNext(request, adminSurface);
  if (path.startsWith("/admin") && !hasAdminSession) return secureRedirect(new URL("/advanced-pro-control", origins.admin));
  if (adminApi && !path.startsWith("/api/admin/auth/") && !path.endsWith("/login") && !hasAdminSession) {
    return NextResponse.json({ ok: false, reason: "admin_auth_required" }, { status: 401 });
  }
  if (isProtectedAppPath(path) && !hasCustomerSession) {
    const login = new URL("/login", origins.auth);
    login.searchParams.set("returnTo", safeReturnTo(`${path}${request.nextUrl.search}`));
    return secureRedirect(login);
  }
  return adminSurface ? secureNext(request, true) : NextResponse.next();
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

function secureNext(request, stripAccessAssertion = false) {
  const response = stripAccessAssertion
    ? NextResponse.next({ request: { headers: downstreamHeaders(request) } })
    : NextResponse.next();
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

function downstreamHeaders(request) {
  const headers = new Headers(request.headers);
  headers.delete("cf-access-jwt-assertion");
  return headers;
}

function staticAssetNext(request) {
  return request.headers.has("cf-access-jwt-assertion")
    ? NextResponse.next({ request: { headers: downstreamHeaders(request) } })
    : NextResponse.next();
}

function directHostname(headers) {
  return String(headers.get("host") || "")
    .split(",")[0]
    .trim()
    .replace(/:\d+$/, "")
    .toLowerCase();
}

function cloudflareAccessResponse(access, apiRequest) {
  const headers = {
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex, nofollow"
  };
  if (apiRequest) {
    return NextResponse.json(
      { ok: false, reason: access.reason },
      { status: access.status, headers }
    );
  }
  return new NextResponse(null, { status: access.status, headers });
}

function wrongHostPageResponse() {
  return new NextResponse(null, {
    status: 404,
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" }
  });
}

function adminHoneypotResponse() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
      "Content-Type": "text/html; charset=utf-8",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow"
    }
  });
}

function logAdminBoundaryEvent(request, reason, host, path) {
  const requestId = request.headers.get("cf-ray") || request.headers.get("x-vercel-id") || "";
  console.warn("renvix_admin_boundary_event", {
    reason: String(reason || "unknown").slice(0, 80),
    host: String(host || "unknown").replace(/[^a-z0-9.:-]/gi, "").slice(0, 253),
    path: String(path || "/").slice(0, 300),
    requestId: String(requestId).slice(0, 160)
  });
}

function wrongHostApiResponse() {
  return NextResponse.json(
    { ok: false, reason: "misdirected_host" },
    { status: 404, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } }
  );
}

export const config = {
  // The reserved honeypot host must never bypass middleware for static assets.
  matcher: ["/:path*"]
};
