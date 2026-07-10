import { expect, test } from "@playwright/test";

test("subscriptions page supports opening the add subscription workflow", async ({ page }) => {
  await page.goto("/dashboard/subscriptions");
  await expect(page.locator(".dashboard-shell")).toBeVisible();
  await page.locator("[data-action='add-subscription']").click();
  await expect(page.locator("[role='dialog']")).toBeVisible();
});
