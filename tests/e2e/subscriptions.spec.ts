import { expect, test } from "@playwright/test";
import { installMockPortalBasics, openMockPortalRoute } from "./helpers/mock-portal";

async function openMockSubscriptions(page) {
  await installMockPortalBasics(page);
  await page.route("**/api/subscriptions**", (route) => route.fulfill({ json: { ok: true, items: [], summary: {} } }));
  await page.route("**/api/customers", (route) => route.fulfill({ json: { ok: true, items: [] } }));
  await openMockPortalRoute(page, "/dashboard/subscriptions");
}

test("subscriptions page supports opening the add subscription workflow", async ({ page }) => {
  await openMockSubscriptions(page);
  await expect(page.locator(".dashboard-shell")).toBeVisible();
  await page.locator("[data-action='add-subscription']").click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("renewal window stays usable until a value is selected", async ({ page }) => {
  await openMockSubscriptions(page);
  const renewalWindow = page.locator("select[data-action='subscription-window']");
  await expect(renewalWindow).toBeVisible();
  await renewalWindow.selectOption("14");
  await expect(renewalWindow).toHaveValue("14");
});
