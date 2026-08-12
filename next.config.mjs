function configuredPublicApiOrigin() {
  try {
    const value = String(process.env.NEXT_PUBLIC_API_BASE_URL || "").trim();
    if (!value) return "";
    const url = new URL(value);
    return url.protocol === "https:" || process.env.NODE_ENV === "development" ? url.origin : "";
  } catch {
    return "";
  }
}

const publicApiOrigin = configuredPublicApiOrigin();

const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async headers() {
    const developmentScriptPolicy = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
    const securityHeaders = [
      {
        key: "Content-Security-Policy",
        value: `default-src 'self'; base-uri 'self'; form-action 'self'${publicApiOrigin ? ` ${publicApiOrigin}` : ""}; frame-ancestors 'none'; object-src 'none'; script-src 'self' 'unsafe-inline'${developmentScriptPolicy} https://static.cloudflareinsights.com https://challenges.cloudflare.com https://accounts.google.com/gsi/client; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com/gsi/style; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self'${publicApiOrigin ? ` ${publicApiOrigin}` : ""} https://cloudflareinsights.com https://challenges.cloudflare.com https://accounts.google.com/gsi/; frame-src 'self' https://challenges.cloudflare.com https://accounts.google.com/gsi/; upgrade-insecure-requests`
      },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" }
    ];
    return [
      {
        source: "/:path*",
        headers: securityHeaders
      },
      {
        source: "/app/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" }
        ]
      },
      {
        source: "/data/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" }
        ]
      }
    ];
  },
  experimental: {
    cpus: 1
  }
};

export default nextConfig;
