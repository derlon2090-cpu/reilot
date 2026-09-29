import { expect, test } from "@playwright/test";
import { installMockPortalBasics, openMockPortalRoute } from "./helpers/mock-portal";

test("customers page supports opening the add customer workflow", async ({ page }) => {
  await installMockPortalBasics(page);
  await page.route("**/api/customers", (route) => route.fulfill({ json: { ok: true, items: [] } }));
  await openMockPortalRoute(page, "/dashboard/customers");
  await expect(page.locator(".dashboard-shell")).toBeVisible();
  await page.getByRole("button", { name: "إضافة عميل", exact: true }).last().click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
