import { expect, test } from "@playwright/test";
import { installMockPortalBasics, openMockPortalRoute } from "./helpers/mock-portal";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("renewpilot_locale", "ar");
    localStorage.setItem("renewpilot_theme", "light");
  });
  await installMockPortalBasics(page);
  await page.route("**/api/subscriptions**", (route) => route.fulfill({ json: { ok: true, items: [], summary: {} } }));
  await page.route("**/api/customers", (route) => route.fulfill({ json: { ok: true, items: [{ id: "customer-1", name: "عميل الاختبار", email: "customer@example.com", phone: "+966500000001" }] } }));
  await page.route("**/api/settings", (route) => route.fulfill({ json: { ok: true, settings: { fullName: "مستخدم الاختبار", email: "test@example.com", role: "owner", language: "ar", theme: "light", interfaceDensity: "comfortable" }, storage: { usedMb: 1, limitMb: 100, percent: 1, breakdown: [] } } }));
  await page.route("**/api/auth/logout", (route) => route.fulfill({ json: { ok: true } }));
});
test("dialogs close using X, Escape, cancel, and overlay", async ({ page }) => {
  await openMockPortalRoute(page, "/dashboard/subscriptions");
  await page.locator("[data-action='add-subscription']").click();
  await expect(page.locator(".modal")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".modal")).toHaveCount(0);

  await page.locator("[data-action='add-subscription']").click();
  await page.locator(".modal-head [data-action='close-modal']").click();
  await expect(page.locator(".modal")).toHaveCount(0);

  await page.locator("[data-action='add-subscription']").click();
  await page.getByRole("button", { name: "إلغاء" }).click();
  await expect(page.locator(".modal")).toHaveCount(0);

  await page.locator("[data-action='add-subscription']").click();
  await page.locator(".modal-overlay").click({ position: { x: 5, y: 5 } });
  await expect(page.locator(".modal")).toHaveCount(0);
});

test("logout is available in settings and returns to login", async ({ page }) => {
  await openMockPortalRoute(page, "/dashboard/settings");
  await page.locator("[data-action='profile-menu']").click();
  await page.locator("[data-action='logout-confirm']").click();
  await expect(page.getByText("هل تريد تسجيل الخروج من حسابك؟")).toBeVisible();
  await page.locator(".modal-foot [data-action='logout']").click();
  await expect(page).toHaveURL(/\/login$/);
});
