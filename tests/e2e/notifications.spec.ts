import { expect, test } from "@playwright/test";
import { installMockPortalBasics, openMockPortalRoute } from "./helpers/mock-portal";

test("notifications page exposes accessible actions for prepared notification fixtures", async ({ page }) => {
  await installMockPortalBasics(page);
  await page.route("**/api/notifications**", (route) => route.fulfill({ json: { ok: true, items: [{ id: "notice-1", type: "subscription.renewal", title: "موعد تجديد قريب", message: "اشتراك العميل يحتاج مراجعة.", isRead: false, actionUrl: "/dashboard/subscriptions", createdAt: "2026-09-29T08:00:00.000Z" }], summary: { unread: 1, today: 1, week: 1, total: 1 } } }));
  await openMockPortalRoute(page, "/dashboard/notifications");
  await expect(page.getByText("موعد تجديد قريب", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "فتح", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/subscriptions$/);
});
