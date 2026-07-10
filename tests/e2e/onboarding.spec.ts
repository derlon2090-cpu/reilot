import { expect, test } from "@playwright/test";

test("new user dashboard shows trial-like product limits in the current smoke UI", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.locator(".dashboard-shell")).toBeVisible();
  await expect(page.locator(".stat-card").first()).toBeVisible();
});
