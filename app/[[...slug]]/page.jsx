import Script from "next/script";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AdminPortal from "../../src/components/admin/AdminPortal.jsx";
import { adminControlPath, getAdminContext } from "../../src/server/admin-auth.js";
import { getSession } from "../../src/server/session.js";

export default async function SpaPage({ params }) {
  const { slug = [] } = await params;
  const requestHeaders = await headers();
  const request = { headers: requestHeaders };
  const requestedPath = slug.join("/");
  const controlPath = adminControlPath();
  const isDashboard = slug[0] === "dashboard";
  const isAdminPortal = Boolean(controlPath) && requestedPath === controlPath;

  if (isAdminPortal) {
    const admin = await getAdminContext(request).catch(() => null);
    return <AdminPortal initialAdmin={admin ? {
      name: admin.name,
      email: admin.email,
      role: admin.adminRole
    } : null} />;
  }

  if (isDashboard) {
    const session = await getSession(request).catch(() => null);
    if (!session) redirect("/login");
  }

  return (
    <>
      <div id="app" />
      <div id="portal" />
      <Script src="/app/app.js?v=20260718-link-session-v4" type="module" strategy="afterInteractive" />
    </>
  );
}
