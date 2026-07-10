import Script from "next/script";

export default function SpaPage() {
  return (
    <>
      <div id="app" />
      <div id="portal" />
      <Script src="/app/app.js" type="module" strategy="afterInteractive" />
    </>
  );
}
