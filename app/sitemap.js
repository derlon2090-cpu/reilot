import { siteBaseUrl } from "../src/server/app-url.js";

export default function sitemap() {
  const baseUrl = siteBaseUrl();
  const now = new Date();
  const helpArticles = [
    "quick-start-guide",
    "subscription-management-guide",
    "integrations-settings-guide",
    "billing-payments-guide",
    "reports-analytics-guide"
  ];
  return [
    { url: `${baseUrl}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/features`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    ...helpArticles.map((slug) => ({ url: `${baseUrl}/blog/${slug}`, lastModified: now, changeFrequency: "monthly", priority: 0.55 })),
    { url: `${baseUrl}/support`, lastModified: now, changeFrequency: "monthly", priority: 0.5 }
  ];
}
