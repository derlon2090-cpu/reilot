import { expect, test } from "@playwright/test";

test("settings toggles are persisted to local storage", async ({ page }) => {
  await page.goto("/dashboard/settings");
  const whatsappToggle = page.locator("input[data-action='setting-toggle'][data-key='whatsapp']");
  await expect(whatsappToggle).toBeVisible();
  await whatsappToggle.setChecked(false);
  await page.locator("[data-action='save-settings']").first().click();
  await page.reload();
  await expect(whatsappToggle).not.toBeChecked();
});
