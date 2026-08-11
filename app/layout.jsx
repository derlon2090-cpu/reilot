import Script from "next/script";

export const metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME || "Renvix",
  description: "منصة ذكية لإدارة الاشتراكات والتجديدات وروابط الطلبات والتنبيهات.",
  icons: {
    icon: [{ url: "/assets/renvix-favicon.svg?v=20260810-2", type: "image/svg+xml", sizes: "any" }],
    shortcut: "/assets/renvix-favicon.svg?v=20260810-2",
    apple: "/assets/renvix-mark-deep-teal.png"
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var theme=localStorage.getItem('renewpilot_theme')||'light';var locale=localStorage.getItem('renewpilot_locale')||'ar';var resolved=theme==='system'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':theme;document.documentElement.dataset.theme=resolved==='dark'?'dark':'light';document.documentElement.lang=locale==='en'?'en':'ar';document.documentElement.dir=locale==='en'?'ltr':'rtl'}catch(e){document.documentElement.dataset.theme='light'}})();` }} />
        <script dangerouslySetInnerHTML={{ __html: `(function(){function sync(){try{var w=Math.max(document.documentElement.clientWidth||0,window.innerWidth||0);var touch=Number(navigator.maxTouchPoints||0)>0;var tabletUa=/iPad|Android|Tablet|SM-T|Pixel C/i.test(navigator.userAgent||'');var forced=new URLSearchParams(location.search).get('_tablet_layout')==='1';var active=(forced||touch||tabletUa)&&w>=641&&w<=1700;if(active)document.documentElement.setAttribute('data-home-tablet-layout','true');else document.documentElement.removeAttribute('data-home-tablet-layout')}catch(e){document.documentElement.removeAttribute('data-home-tablet-layout')}}sync();window.addEventListener('resize',sync,{passive:true})})();` }} />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__RENVIX_CONFIG__=${JSON.stringify({
              metaWhatsAppEnabled: Boolean(process.env.NEXT_PUBLIC_META_WHATSAPP_CONNECT_URL),
              metaWhatsAppConnectUrl: process.env.NEXT_PUBLIC_META_WHATSAPP_CONNECT_URL || ""
            }).replace(/</g, "\\u003c")};`
          }}
        />
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{if(!window.matchMedia('(min-width:744px)').matches)return;var p=location.pathname;var m={'/login':['dashboard-v2.png'],'/register':['dashboard-v2.png'],'/forgot-password':['reset-v2.png'],'/reset-password':['reset-v2.png'],'/auth/verify-mfa':['mfa-v2.png'],'/auth/verify-email':['signup-otp-v2.png','login-otp-v2.png']};(m[p]||[]).forEach(function(n){var l=document.createElement('link');l.rel='preload';l.as='image';l.fetchPriority='high';l.href='/app/assets/auth-reference/'+n+'?v=20260810-auth-art-v29';l.dataset.authReferencePreload='true';document.head.appendChild(l)})}catch(e){}})();` }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Tajawal:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/app/styles/tokens.css" />
        <link rel="stylesheet" href="/app/styles/globals.css?v=20260811-pricing-current-only-v78" />
        <link rel="stylesheet" href="/app/styles/dark-system.css?v=20260811-auth-art-cleanup-v68" />
      </head>
      <body>
        {children}
        <Script type="module" src="/app/app.js?v=20260811-pricing-current-only-v78" strategy="afterInteractive" />
      </body>
    </html>
  );
}
