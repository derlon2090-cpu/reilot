import { expect, test } from "@playwright/test";

test("pricing selection carries the selected plan into login", async ({ page }) => {
  await page.goto("/pricing");
  await page.locator("[data-action='billing'][data-billing='yearly']").click();
  await page.locator("[data-action='select-plan'][data-plan='pro']").click();
  await expect(page).toHaveURL(/\/login\?plan=pro$/);
});
