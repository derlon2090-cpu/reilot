import { NextResponse } from "next/server";
export function middleware(request) {
  const path = request.nextUrl.pathname;
  const hasSession = Boolean(request.cookies.get("renewpilot_session")?.value);
  const isSetupPage = path === "/admin/setup";
  const isSetupApi = path.startsWith("/api/admin/setup/");
  const isOneTimeEmergencyRecovery = path === "/api/admin/emergency-recovery";
  if (isSetupPage || isSetupApi || isOneTimeEmergencyRecovery) {
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  }
  if (path.startsWith("/admin") && !hasSession) {
    return NextResponse.redirect(new URL("/advanced-pro-control", request.url));
  }
  if (path.startsWith("/api/admin") && !path.startsWith("/api/admin/auth/") && !path.endsWith("/login") && !hasSession) {
    return NextResponse.json({ ok: false, reason: "admin_auth_required" }, { status: 401 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"]
};
