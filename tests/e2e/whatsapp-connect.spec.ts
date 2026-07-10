import { expect, test } from "@playwright/test";

test("settings integrations action opens a modal for WhatsApp connection work", async ({ page }) => {
  await page.goto("/dashboard/settings");
  await page.locator("[data-action='manage-integrations']").click();
  await expect(page.locator("[role='dialog']")).toBeVisible();
});
