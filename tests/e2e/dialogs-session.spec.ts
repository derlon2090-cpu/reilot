import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("renewpilot_locale", "ar");
    localStorage.setItem("renewpilot_theme", "light");
  });
});
test("dialogs close using X, Escape, cancel, and overlay", async ({ page }) => {
  await page.goto("/dashboard/subscriptions");
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
  await page.goto("/dashboard/settings");
  await page.locator(".session-card [data-action='logout-confirm']").click();
  await expect(page.getByText("هل تريد تسجيل الخروج من حسابك؟")).toBeVisible();
  await page.locator(".modal-foot [data-action='logout']").click();
  await expect(page).toHaveURL(/\/login$/);
});
