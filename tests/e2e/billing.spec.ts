import { expect, test } from "@playwright/test";

test("standalone pricing renders the packages page", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page).toHaveURL(/\/pricing$/);
  await expect(page.getByRole("heading", { name: "الباقات" })).toBeVisible();
  await expect(page.locator(".pricing-public-grid")).toBeVisible();
  await page.locator('[data-link="/register?plan=business"]').click();
  await expect(page).toHaveURL(/\/register\?plan=business$/);
});
