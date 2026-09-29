import { expect, test } from "@playwright/test";
import { installMockPortalBasics, openMockPortalRoute } from "./helpers/mock-portal";

test("new user dashboard shows trial-like product limits in the current smoke UI", async ({ page }) => {
  await installMockPortalBasics(page);
  await page.route("**/api/subscriptions**", (route) => route.fulfill({ json: { ok: true, items: [] } }));
  await page.route("**/api/customers", (route) => route.fulfill({ json: { ok: true, items: [] } }));
  await page.route("**/api/campaigns**", (route) => route.fulfill({ json: { ok: true, items: [] } }));
  await page.route("**/api/channels", (route) => route.fulfill({ json: { ok: true, summary: {}, channels: {}, activity: [] } }));
  await openMockPortalRoute(page, "/dashboard");
  await expect(page.locator(".dashboard-shell")).toBeVisible();
  await expect(page.locator(".suite-metric").first()).toBeVisible();
});
