export const metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME || "Renvix",
  description: "منصة ذكية لإدارة الاشتراكات والتجديدات وروابط الطلبات والتنبيهات."
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var theme=localStorage.getItem('renewpilot_theme')||'light';var locale=localStorage.getItem('renewpilot_locale')||'ar';var resolved=theme==='system'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':theme;document.documentElement.dataset.theme=resolved==='dark'?'dark':'light';document.documentElement.lang=locale==='en'?'en':'ar';document.documentElement.dir=locale==='en'?'ltr':'rtl'}catch(e){document.documentElement.dataset.theme='light'}})();` }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700;800&family=Poppins:wght@700;800&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/app/styles/tokens.css" />
        <link rel="stylesheet" href="/app/styles/globals.css?v=20260720-subscription-delivery-v4" />
      </head>
      <body>{children}</body>
    </html>
  );
}
