import Script from "next/script";
import { Alexandria } from "next/font/google";
import { adminBaseUrl, appBaseUrl, authBaseUrl, siteBaseUrl } from "../src/server/app-url.js";
import { publicAuthApiOrigin } from "../src/server/auth-backend-runtime.js";

const alexandria = Alexandria({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-alexandria"
});

export const metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME || "Renvix",
  description: "منصة ذكية لإدارة الاشتراكات والتجديدات وروابط الطلبات والتنبيهات.",
  icons: {
    icon: [{ url: "/assets/renvix-favicon.svg?v=20260912-auth-v108", type: "image/svg+xml", sizes: "any" }],
    shortcut: "/assets/renvix-favicon.svg?v=20260912-auth-v108",
    apple: "/assets/renvix-favicon.svg?v=20260912-auth-v108"
  }
};

export default function RootLayout({ children }) {
  // Change this only when public/app/app.js changes so routine deploys reuse the browser cache.
  const appBundleVersion = "102458e6acd1bacfe3c6286066947998a2e05e1ac2bf4692778ed8a3f74313a4";
  const appUrl = appBaseUrl();
  const adminUrl = adminBaseUrl();
  const siteUrl = siteBaseUrl();
  const authUrl = authBaseUrl();
  const authApiUrl = publicAuthApiOrigin();
  return (
    <html lang="ar" dir="rtl" className={alexandria.variable} suppressHydrationWarning>
      <head>
        <meta name="renvix-turnstile-site-key" content={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ""} />
        <link rel="preconnect" href="https://challenges.cloudflare.com" crossOrigin="anonymous" />
        <script dangerouslySetInnerHTML={{ __html: `(function(){var p=location.pathname;if(p.endsWith('/'))p=p.slice(0,-1);if(!['/login','/register','/forgot-password','/reset-password'].includes(p))return;var s=document.createElement('script');s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';s.async=true;s.dataset.renvixTurnstile='true';document.head.appendChild(s)})();` }} />
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var theme=localStorage.getItem('renewpilot_theme')||'light';var locale=localStorage.getItem('renewpilot_locale')||'ar';var resolved=theme==='system'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':theme;document.documentElement.dataset.theme=resolved==='dark'?'dark':'light';document.documentElement.lang=locale==='en'?'en':'ar';document.documentElement.dir=locale==='en'?'ltr':'rtl'}catch(e){document.documentElement.dataset.theme='light'}})();` }} />
        <script dangerouslySetInnerHTML={{ __html: `(function(){document.addEventListener('error',function(event){var link=event.target;if(link&&link.tagName==='LINK'&&String(link.rel||'').split(/\\s+/).includes('stylesheet'))document.documentElement.setAttribute('data-auth-styles-failed','true')},true)})();` }} />
        <script dangerouslySetInnerHTML={{ __html: `(function(){function sync(){try{var w=Math.max(document.documentElement.clientWidth||0,window.innerWidth||0);var touch=Number(navigator.maxTouchPoints||0)>0;var tabletUa=/iPad|Android|Tablet|SM-T|Pixel C/i.test(navigator.userAgent||'');var forced=new URLSearchParams(location.search).get('_tablet_layout')==='1';var active=(forced||touch||tabletUa)&&w>=641&&w<=1700;if(active)document.documentElement.setAttribute('data-home-tablet-layout','true');else document.documentElement.removeAttribute('data-home-tablet-layout')}catch(e){document.documentElement.removeAttribute('data-home-tablet-layout')}}sync();window.addEventListener('resize',sync,{passive:true})})();` }} />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__RENVIX_CONFIG__=${JSON.stringify({
              appUrl,
              adminUrl,
              siteUrl,
              authUrl,
              authApiUrl,
              turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "",
              turnstileDiagnostics: process.env.TURNSTILE_DIAGNOSTICS_ENABLED === "true",
              metaWhatsAppEnabled: Boolean(process.env.NEXT_PUBLIC_META_WHATSAPP_CONNECT_URL),
              metaWhatsAppConnectUrl: process.env.NEXT_PUBLIC_META_WHATSAPP_CONNECT_URL || ""
            }).replace(/</g, "\\u003c")};`
          }}
        />
        <link rel="stylesheet" href="/app/styles/tokens.css" />
        <link rel="preload" as="image" href="/assets/renvix-logo-primary.png" fetchPriority="high" />
        <link rel="modulepreload" href={`/app/app.js?v=${appBundleVersion}`} crossOrigin="anonymous" />
        <link rel="preload" as="fetch" href="/app/locales/ar.json" crossOrigin="anonymous" />
        <link rel="preload" as="fetch" href="/app/locales/en.json" crossOrigin="anonymous" />
        <link rel="stylesheet" href="/app/styles/globals.css?v=20261105-entry-loader-v1" />
        <link rel="stylesheet" href="/app/styles/dark-system.css?v=20260813-preferences-v109" />
        <link rel="stylesheet" href="/app/styles/approved-templates-reference.css?v=20260911-brand-surfaces-v159" />
        <link rel="stylesheet" href="/app/styles/identity-system.css?v=20260911-brand-surfaces-v159" />
        <link rel="stylesheet" href="/app/styles/auth-renvix.css?v=20260914-auth-renvix-v162" media="(min-width: 768px)" />
        <style dangerouslySetInnerHTML={{ __html: `
          html[data-auth-styles-failed] body:has(.auth-suite-page){margin:0;font-family:Arial,sans-serif;color:#102f39;background:#f5faf9}
          html[data-auth-styles-failed] .auth-suite-page{display:grid;place-items:center;min-height:100vh;box-sizing:border-box;padding:24px;background:linear-gradient(145deg,#fbfdfc,#f3faf8)}
          html[data-auth-styles-failed] .auth-suite-page *{box-sizing:border-box}
          html[data-auth-styles-failed] .auth-suite-stage{width:min(1360px,100%);margin:auto}
          html[data-auth-styles-failed] .auth-suite-stage>.auth-suite-brandbar{display:none}
          html[data-auth-styles-failed] .auth-suite-shell{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:28px;align-items:stretch;direction:ltr;width:100%}
          html[data-auth-styles-failed] .auth-suite-shell>article{grid-column:2;grid-row:1;direction:rtl;display:flex;flex-direction:column;justify-content:center;min-width:0;min-height:620px;margin:0;padding:clamp(24px,4vw,52px);border:1px solid #dbe7e4;border-radius:24px;background:#fff;box-shadow:0 18px 52px #0b3f3b12}
          html[data-auth-styles-failed] .auth-suite-shell>aside{grid-column:1;grid-row:1;min-width:0;min-height:620px;border:1px solid #d3e7e2;border-radius:24px;background:linear-gradient(145deg,#f1faf8,#e7f5f2);overflow:hidden}
          html[data-auth-styles-failed] .renvix-auth-card-header{display:block;margin-bottom:24px}
          html[data-auth-styles-failed] .renvix-auth-card-header .auth-suite-brandbar{display:flex;align-items:center;justify-content:space-between;gap:12px}
          html[data-auth-styles-failed] .renvix-auth-card-header .brand-logo-stacked,html[data-auth-styles-failed] .renvix-auth-card-header .brand-logo-image{display:block;width:140px;max-width:45vw;height:auto}
          html[data-auth-styles-failed] .auth-suite-brandbar-controls{display:flex;align-items:center;gap:8px}
          html[data-auth-styles-failed] .auth-suite-brandbar-controls button{border:0;background:transparent;color:#0b3f3b;padding:8px;cursor:pointer}
          html[data-auth-styles-failed] .auth-mobile-brand,html[data-auth-styles-failed] .auth-mobile-scene{display:none}
          html[data-auth-styles-failed] .auth-suite-intro{margin-bottom:20px}
          html[data-auth-styles-failed] .auth-suite-intro h1{margin:0 0 8px;font-size:clamp(30px,3vw,42px);line-height:1.3;color:#102f39}
          html[data-auth-styles-failed] .auth-suite-intro p{margin:0;color:#61747c;line-height:1.8}
          html[data-auth-styles-failed] .auth-suite-form,html[data-auth-styles-failed] .auth-form,html[data-auth-styles-failed] .email-otp-form{display:grid;gap:14px}
          html[data-auth-styles-failed] .field{display:grid;gap:7px;min-width:0}
          html[data-auth-styles-failed] .field>span,html[data-auth-styles-failed] .email-otp-form>label{font-weight:700;color:#183d3a}
          html[data-auth-styles-failed] .input{width:100%;min-width:0;min-height:48px;padding:10px 14px;border:1px solid #d5e4e0;border-radius:12px;background:#fff;color:#183d3a;font:inherit}
          html[data-auth-styles-failed] .btn,html[data-auth-styles-failed] button{font:inherit}
          html[data-auth-styles-failed] .auth-submit,html[data-auth-styles-failed] .btn-primary{min-height:48px;padding:10px 18px;border:1px solid #0b625a;border-radius:12px;background:#0b625a;color:#fff;font-weight:700;cursor:pointer}
          html[data-auth-styles-failed] .btn-secondary{min-height:44px;padding:9px 14px;border:1px solid #d5e4e0;border-radius:12px;background:#fff;color:#0b3f3b;cursor:pointer}
          html[data-auth-styles-failed] .auth-suite-mode-tabs{display:flex;gap:6px;margin-bottom:20px;padding:4px;border:1px solid #dbe7e4;border-radius:14px;background:#f5f9f8}
          html[data-auth-styles-failed] .auth-suite-mode-tabs button{flex:1;min-height:42px;border:0;border-radius:10px;background:transparent;color:#61747c;cursor:pointer}
          html[data-auth-styles-failed] .auth-suite-mode-tabs button.active{background:#0b3f3b;color:#fff}
          html[data-auth-styles-failed] .auth-register-grid,html[data-auth-styles-failed] .auth-register-passwords{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
          html[data-auth-styles-failed] .policy-check{display:flex;align-items:flex-start;gap:8px;color:#61747c;line-height:1.6}
          html[data-auth-styles-failed] .auth-switch,html[data-auth-styles-failed] .auth-legal,html[data-auth-styles-failed] .auth-suite-note{color:#61747c;line-height:1.7}
          @media(max-width:820px){html[data-auth-styles-failed] .auth-suite-page{display:block;padding:14px}html[data-auth-styles-failed] .auth-suite-stage>.auth-suite-brandbar{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:56px;margin-bottom:12px}html[data-auth-styles-failed] .auth-suite-stage>.auth-suite-brandbar .brand-logo-stacked,html[data-auth-styles-failed] .auth-suite-stage>.auth-suite-brandbar .brand-logo-image{width:130px;height:auto}html[data-auth-styles-failed] .auth-suite-shell{display:block}html[data-auth-styles-failed] .auth-suite-shell>article{min-height:0;padding:22px}html[data-auth-styles-failed] .auth-suite-shell>aside,html[data-auth-styles-failed] .renvix-auth-card-header{display:none}html[data-auth-styles-failed] .auth-mobile-brand{display:none}html[data-auth-styles-failed] .auth-register-grid,html[data-auth-styles-failed] .auth-register-passwords{grid-template-columns:1fr}}
        ` }} />
      </head>
      <body>
        {children}
        <Script type="module" src={`/app/app.js?v=${appBundleVersion}`} strategy="afterInteractive" />
      </body>
    </html>
  );
}
