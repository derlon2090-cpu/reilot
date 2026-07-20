import { NextResponse } from "next/server";
export function middleware(request) {
  const path = request.nextUrl.pathname;
  const hasSession = Boolean(request.cookies.get("renewpilot_session")?.value);
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
