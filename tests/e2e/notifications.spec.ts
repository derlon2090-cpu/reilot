import { expect, test } from "@playwright/test";

test("notifications page opens template preview and message actions", async ({ page }) => {
  await page.goto("/dashboard/notifications");
  await page.locator("[data-action='preview-template']").click();
  await expect(page.locator("[role='dialog']")).toBeVisible();
});
