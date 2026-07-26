import { appBaseUrl } from "../src/server/app-url.js";

export default function robots() {
  const siteUrl = appBaseUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/", "/dashboard/", "/advanced-pro-control"]
      }
    ],
    sitemap: `${siteUrl}/sitemap.xml`
  };
}
