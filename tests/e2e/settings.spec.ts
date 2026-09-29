import { expect, test } from "@playwright/test";
import { installMockPortalBasics, openMockPortalRoute } from "./helpers/mock-portal";

test("settings cards keep the current RTL order and expose account controls", async ({ page }) => {
  await installMockPortalBasics(page);
  await page.route("**/api/settings", (route) => route.fulfill({ json: { ok: true, settings: { fullName: "مستخدم الاختبار", email: "test@example.com", phone: "+966500000000", role: "owner", language: "ar", theme: "light", interfaceDensity: "comfortable", mfaEnabled: true }, storage: { usedMb: 1, limitMb: 100, percent: 1, breakdown: [] }, newsletter: { publicId: "news-test" } } }));
  await openMockPortalRoute(page, "/dashboard/settings");
  const cards = page.locator(".settings-reference-grid > article");
  await expect(cards).toHaveCount(4);
  await expect(cards.nth(0)).toContainText("إعدادات الحساب");
  await expect(cards.nth(1)).toContainText("أمان الحساب");
  await expect(cards.nth(2)).toContainText("النشرة البريدية");
  await expect(cards.nth(3)).toContainText("حد التخزين في الباقة");
  await expect(page.getByRole("button", { name: "حفظ التعديلات" })).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
});
