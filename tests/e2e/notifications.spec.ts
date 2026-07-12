import { expect, test } from "@playwright/test";
import { hasLiveCredentials, loginWithLiveCredentials } from "./helpers/live-auth";

test.skip(!hasLiveCredentials, "requires a real authenticated test account");

test("notifications page opens template preview and message actions", async ({ page }) => {
  await loginWithLiveCredentials(page);
  await page.goto("/dashboard/notifications");
  await page.locator("[data-action='preview-template']").click();
  await expect(page.locator("[role='dialog']")).toBeVisible();
});
