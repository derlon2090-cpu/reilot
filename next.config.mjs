const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async headers() {
    const securityHeaders = [
      {
        key: "Content-Security-Policy",
        value: "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self'; upgrade-insecure-requests"
      },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      { key: "X-Frame-Options", value: "DENY" }
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
      }
    ];
  },
  experimental: {
    cpus: 1
  }
};

export default nextConfig;
