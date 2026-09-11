import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "../../src/server/session.js";
import { authBaseUrl } from "../../src/server/app-url.js";
import { isAuthPath, safeReturnTo } from "../../src/shared/auth-portal.js";

const authTitles = {
  login: "تسجيل الدخول | Renvix",
  register: "إنشاء حساب | Renvix",
  "forgot-password": "استعادة كلمة المرور | Renvix",
  "reset-password": "تعيين كلمة مرور جديدة | Renvix",
  "verify-email": "تحقق من بريدك الإلكتروني | Renvix",
  "verify-mfa": "المصادقة الثنائية | Renvix",
  recovery: "استرداد الوصول | Renvix"
};

export async function generateMetadata({ params }) {
  const { slug = [] } = await params;
  const title = authTitles[slug[0]];
  return title ? { title, robots: { index: false, follow: false } } : {};
}

export default async function SpaPage({ params }) {
  const { slug = [] } = await params;
  const isDashboard = slug[0] === "dashboard";
  const path = `/${slug.join("/")}`;
  const authPath = isAuthPath(path);
  const showPublicHeaderFallback = !isDashboard && !authPath;

  if (isDashboard || authPath) {
    const requestHeaders = await headers();
    const request = { headers: requestHeaders };
    const session = await getSession(request).catch(() => null);
    if (isDashboard && !session) {
      const login = new URL("/login", authBaseUrl());
      login.searchParams.set("returnTo", safeReturnTo(path));
      redirect(login.toString());
    }
    if (authPath && session && (path === "/login" || path === "/register")) {
      const continuation = new URL("/api/auth/session/continue", authBaseUrl());
      continuation.searchParams.set("returnTo", "/dashboard");
      redirect(continuation.toString());
    }
  }

  return (
    <>
      <div id="app">
        {showPublicHeaderFallback ? (
          <nav className="public-nav public-nav-bootstrap" aria-label="التنقل الرئيسي" style={{ minHeight: "74px" }}>
            <div className="container nav-inner" style={{ minHeight: "74px", display: "flex", alignItems: "center", justifyContent: "flex-start" }}>
              <a className="brand btn-ghost" href="/" aria-label="Renvix" style={{ width: "188px", minWidth: "188px", height: "54px", display: "inline-flex", alignItems: "center" }}>
                <img
                  className="brand-logo-image brand-logo-image--primary"
                  src="/assets/renvix-logo-primary.png"
                  width="814"
                  height="228"
                  alt="Renvix"
                  fetchPriority="high"
                  style={{ width: "188px", height: "auto", maxHeight: "52px", objectFit: "contain" }}
                />
              </a>
            </div>
          </nav>
        ) : null}
      </div>
      <div id="portal" />
    </>
  );
}
