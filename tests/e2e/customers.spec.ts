import { expect, test } from "@playwright/test";
import { hasLiveCredentials, loginWithLiveCredentials } from "./helpers/live-auth";

test.skip(!hasLiveCredentials, "requires a real authenticated test account");

test("customers page supports opening the add customer workflow", async ({ page }) => {
  await loginWithLiveCredentials(page);
  await page.goto("/dashboard/customers");
  await expect(page.locator(".dashboard-shell")).toBeVisible();
  await page.locator("[data-action='add-customer']").click();
  await expect(page.locator("[role='dialog']")).toBeVisible();
});
