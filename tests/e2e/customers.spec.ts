import { expect, test } from "@playwright/test";

test("customers page supports opening the add customer workflow", async ({ page }) => {
  await page.goto("/dashboard/customers");
  await expect(page.locator(".dashboard-shell")).toBeVisible();
  await page.locator("[data-action='add-customer']").click();
  await expect(page.locator("[role='dialog']")).toBeVisible();
});
