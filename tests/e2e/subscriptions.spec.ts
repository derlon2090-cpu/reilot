import { expect, test } from "@playwright/test";
import { hasLiveCredentials, loginWithLiveCredentials } from "./helpers/live-auth";

test.skip(!hasLiveCredentials, "requires a real authenticated test account");

test("subscriptions page supports opening the add subscription workflow", async ({ page }) => {
  await loginWithLiveCredentials(page);
  await page.goto("/dashboard/subscriptions");
  await expect(page.locator(".dashboard-shell")).toBeVisible();
  await page.locator("[data-action='add-subscription']").click();
  await expect(page.locator("[role='dialog']")).toBeVisible();
});
