import Script from "next/script";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "../../src/server/session.js";

export default async function SpaPage({ params }) {
  const { slug = [] } = await params;
  const isDashboard = slug[0] === "dashboard";

  if (isDashboard) {
    const requestHeaders = await headers();
    const request = { headers: requestHeaders };
    const session = await getSession(request).catch(() => null);
    if (!session) redirect("/login");
  }

  return (
    <>
      <div id="app" />
      <div id="portal" />
      <Script src="/app/app.js?v=20260720-security-toast-v3" type="module" strategy="afterInteractive" />
    </>
  );
}
