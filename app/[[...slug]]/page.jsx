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
  if (slug[0] === "shared" && slug[1] === "document") {
    return { title: "ملف مشترك | Renvix", robots: { index: false, follow: false } };
  }
  if (slug[0] === "shared" && slug[1] === "folder") {
    return { title: "مجلد مشترك | Renvix", robots: { index: false, follow: false } };
  }
  const title = authTitles[slug[0]];
  return title ? { title, robots: { index: false, follow: false } } : {};
}

export default async function SpaPage({ params }) {
  const { slug = [] } = await params;
  const isDashboard = slug[0] === "dashboard";
  const path = `/${slug.join("/")}`;
  const authPath = isAuthPath(path);

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
        <main role="status" aria-live="polite" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, boxSizing: "border-box", background: "#f7faf9", color: "#123c38", fontFamily: "Arial, sans-serif", textAlign: "center" }}>
          <div style={{ maxWidth: 420, padding: 34, border: "1px solid #dcebe7", borderRadius: 20, background: "#fff", boxShadow: "0 18px 60px #0a51400d" }}>
            <strong style={{ fontSize: 20 }}>جارٍ تجهيز Renvix</strong>
            <p style={{ margin: "12px 0 0", color: "#647b78", lineHeight: 1.8 }}>لحظات ونفتح لك الصفحة.</p>
          </div>
        </main>
      </div>
      <div id="portal" />
    </>
  );
}
