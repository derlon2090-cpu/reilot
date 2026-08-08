export const metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME || "Renvix",
  description: "منصة ذكية لإدارة الاشتراكات والتجديدات وروابط الطلبات والتنبيهات.",
  icons: {
    icon: [{ url: "/assets/renvix-mark-deep-teal.svg", type: "image/svg+xml" }],
    shortcut: "/assets/renvix-mark-deep-teal.svg",
    apple: "/assets/renvix-mark-deep-teal.png"
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var theme=localStorage.getItem('renewpilot_theme')||'light';var locale=localStorage.getItem('renewpilot_locale')||'ar';var resolved=theme==='system'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':theme;document.documentElement.dataset.theme=resolved==='dark'?'dark':'light';document.documentElement.lang=locale==='en'?'en':'ar';document.documentElement.dir=locale==='en'?'ltr':'rtl'}catch(e){document.documentElement.dataset.theme='light'}})();` }} />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__RENVIX_CONFIG__=${JSON.stringify({
              metaWhatsAppEnabled: Boolean(process.env.NEXT_PUBLIC_META_WHATSAPP_CONNECT_URL),
              metaWhatsAppConnectUrl: process.env.NEXT_PUBLIC_META_WHATSAPP_CONNECT_URL || ""
            }).replace(/</g, "\\u003c")};`
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Tajawal:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/app/styles/tokens.css" />
        <link rel="stylesheet" href="/app/styles/globals.css?v=20260731-support-guides-v12" />
      </head>
      <body>{children}</body>
    </html>
  );
}
