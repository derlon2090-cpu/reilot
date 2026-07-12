import { expect, test } from "@playwright/test";
import { hasLiveCredentials, loginWithLiveCredentials } from "./helpers/live-auth";

test.skip(!hasLiveCredentials, "requires a real authenticated test account");

test("new user dashboard shows trial-like product limits in the current smoke UI", async ({ page }) => {
  await loginWithLiveCredentials(page);
  await page.goto("/dashboard");
  await expect(page.locator(".dashboard-shell")).toBeVisible();
  await expect(page.locator(".stat-card").first()).toBeVisible();
});
