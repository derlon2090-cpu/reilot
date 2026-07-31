import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

async function mockDashboardBasics(page) {
  await page.route("**/api/auth/session", (route) => route.fulfill({
    json: { ok: true, user: { id: "user-1", role: "owner", mustChangePassword: false } }
  }));
  await page.route("**/api/dashboard/overview", (route) => route.fulfill({ json: { ok: true, stats: {}, profile: {} } }));
  await page.route("**/api/billing/message-usage", (route) => route.fulfill({ json: { ok: true, used: 0, limit: 100 } }));
  await page.route("**/api/notifications**", (route) => route.fulfill({ json: { ok: true, items: [], unreadCount: 0 } }));
}

test("template previews stay on the left and shared store branding is available", async ({ page }) => {
  test.setTimeout(120_000);
  await mkdir(".codex-artifacts", { recursive: true });
  await page.setViewportSize({ width: 1600, height: 1000 });
  await mockDashboardBasics(page);

  const logoUrl = "https://assets.example.com/store-logo.webp";
  await page.route("**/api/order-link/profile", (route) => route.fulfill({
    json: { ok: true, profile: { id: "profile-1", storeName: "متجر الاختبار", slug: "test-store", logoUrl, defaultTemplateStyle: "classic", defaultThemeColor: "#2563EB" } }
  }));
  await page.route("**/api/templates/renewal", (route) => route.fulfill({
    json: {
      ok: true,
      templates: [{ id: "email-1", channel: "email", name: "قالب بريد التجديد", storeName: "متجر الاختبار", title: "تذكير التجديد", body: "مرحبًا {{اسم_العميل}}", buttonLabel: "جدد الآن", footerText: "شكرًا لك", themeColor: "#0EA5A8", isActive: true }],
      rules: [{ templateId: "email-1", channel: "email", daysOffset: 7, isActive: true }]
    }
  }));
  await page.route("**/api/templates/catalog", (route) => route.fulfill({ json: { ok: true, items: [] } }));
  await page.route("**/api/whatsapp/templates", (route) => route.fulfill({ json: { ok: true, items: [], integrations: [] } }));
  await page.route("**/api/customers", (route) => route.fulfill({ json: { ok: true, items: [] } }));
  await page.route("**/api/order-information/template", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/order-link/subscriptions", (route) => route.fulfill({ json: { ok: true, items: [] } }));
  await page.route("**/api/order-link/list", (route) => route.fulfill({ json: { ok: true, items: [], stats: {} } }));

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".marketing-copy")).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => {
    history.pushState({}, "", "/dashboard/templates?edit=renewal_email");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });

  await expect(page.locator(".store-logo-editor")).toBeVisible();
  await expect(page.locator(".email-preview-brand img.email-store-logo")).toHaveAttribute("src", logoUrl);
  const emailEditor = await page.locator(".email-editor-v2").boundingBox();
  const emailPreview = await page.locator(".email-preview-v2").boundingBox();
  expect(emailEditor && emailPreview && emailPreview.x < emailEditor.x).toBe(true);
  await page.screenshot({ path: ".codex-artifacts/renewal-email-store-branding.png", fullPage: true });

  await page.evaluate(() => {
    history.pushState({}, "", "/dashboard/order-links");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page.locator(".order-store-logo-field .store-logo-editor")).toBeVisible();
  await expect(page.locator(".order-lookup-brand img.order-store-logo")).toHaveAttribute("src", logoUrl);
  const orderEditor = await page.locator(".order-link-builder").boundingBox();
  const orderPreview = await page.locator(".order-link-preview-panel").boundingBox();
  expect(orderEditor && orderPreview && orderPreview.x < orderEditor.x).toBe(true);
  await page.screenshot({ path: ".codex-artifacts/order-information-store-branding.png", fullPage: true });
});
