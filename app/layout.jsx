export const metadata = {
  title: "RenewPilot AI",
  description: "منصة عربية لإدارة الاشتراكات والتجديدات والتنبيهات."
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/app/styles/tokens.css" />
        <link rel="stylesheet" href="/app/styles/globals.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
