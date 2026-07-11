import Script from "next/script";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "../../src/server/session.js";

export default async function SpaPage({ params }) {
  const { slug = [] } = await params;
  const isDashboard = slug[0] === "dashboard";
  const e2ePreview = process.env.E2E_UI_PREVIEW === "1";

  if (isDashboard && !e2ePreview) {
    const requestHeaders = await headers();
    const session = await getSession({ headers: requestHeaders }).catch(() => null);
    if (!session) redirect("/login");
  }

  return (
    <>
      <div id="app" />
      <div id="portal" />
      {e2ePreview ? <script dangerouslySetInnerHTML={{ __html: "window.__RENEWPILOT_E2E_PREVIEW__=true" }} /> : null}
      <Script src="/app/app.js" type="module" strategy="afterInteractive" />
    </>
  );
}
