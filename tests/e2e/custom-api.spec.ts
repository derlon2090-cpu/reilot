import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

test("a genuine API key stays visible after creation and can be revoked", async ({ page }) => {
  test.setTimeout(60_000);
  await mkdir(".codex-artifacts", { recursive: true });
  const rawKey = "rvx_test_0123456789abcdef0123456789abcdef_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi0123456789";
  const prefix = "rvx_test_0123456789abcdef0123456789abcdef";
  let created = false;
  let revoked = false;
  let postCreateGets = 0;

  const integration = () => ({
    id: "integration-1",
    name: "نظام المتجر الداخلي",
    description: "تكامل اختبار",
    environment: "test",
    direction: "bidirectional",
    status: "ACTIVE",
    scopes: ["customers:read", "messages:send"],
    latestKeyPrefix: revoked ? null : prefix,
    activeKeys: revoked ? 0 : 1,
    activeWebhooks: 0,
    keys: [{
      id: "key-1",
      name: "المفتاح الرئيسي",
      prefix,
      status: revoked ? "REVOKED" : "ACTIVE",
      revokedAt: revoked ? "2026-07-30T21:30:00.000Z" : null,
      createdAt: "2026-07-30T21:00:00.000Z",
      scopes: ["customers:read", "messages:send"]
    }],
    webhooks: [],
    recentDeliveries: [],
    webhook: {}
  });

  await page.route("**/api/auth/session", (route) => route.fulfill({
    json: { ok: true, user: { id: "user-1", role: "owner", mustChangePassword: false } }
  }));
  await page.route("**/api/dashboard/overview", (route) => route.fulfill({ json: { ok: true, stats: {}, profile: {} } }));
  await page.route("**/api/billing/message-usage", (route) => route.fulfill({ json: { ok: true, used: 0, limit: 100 } }));
  await page.route("**/api/notifications**", (route) => route.fulfill({ json: { ok: true, items: [], unreadCount: 0 } }));
  await page.route("**/api/integrations/custom/integration-1/keys/key-1", async (route) => {
    expect(route.request().method()).toBe("DELETE");
    revoked = true;
    await route.fulfill({ json: { ok: true, item: { id: "key-1", prefix, revokedAt: "2026-07-30T21:30:00.000Z" } } });
  });
  await page.route("**/api/integrations/custom", async (route) => {
    if (route.request().method() === "POST") {
      created = true;
      return route.fulfill({
        status: 201,
        json: {
          ok: true,
          item: {
            id: "integration-1",
            name: "نظام المتجر الداخلي",
            environment: "test",
            direction: "bidirectional",
            status: "ACTIVE"
          },
          key: integration().keys[0],
          apiKey: rawKey,
          warning: "انسخ المفتاح الآن."
        }
      });
    }
    if (!created) return route.fulfill({ json: { ok: true, items: [] } });
    postCreateGets += 1;
    if (postCreateGets === 1) return route.fulfill({ json: { ok: true, items: [] } });
    return route.fulfill({ json: { ok: true, items: [integration()] } });
  });

  await page.goto("/");
  await page.evaluate(() => {
    history.pushState({}, "", "/dashboard/settings/integrations/custom-api/setup");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });

  const form = page.locator("form[data-submit='custom-integration']");
  await expect(form).toBeVisible();
  await form.locator("input[name='name']").fill("نظام المتجر الداخلي");
  await form.locator("select[name='environment']").selectOption("test");
  await form.locator("input[name='direction'][value='bidirectional']").check();
  await form.locator("button[type='submit']").click();

  await expect(page).toHaveURL(/\/dashboard\/settings\/integrations\/custom-api\/key-created$/);
  await expect(page.locator(".capi-key-card .capi-key-copy code")).toHaveText(rawKey);
  await page.waitForTimeout(250);
  await expect(page.locator(".capi-key-card .capi-key-copy code")).toHaveText(rawKey);

  await page.locator(".capi-page-actions [data-link='/dashboard/settings/integrations/custom-api']").click();
  await expect(page).toHaveURL(/\/dashboard\/settings\/integrations\/custom-api$/);
  await expect(page.locator(".capi-one-time-key code")).toHaveText(rawKey);
  await expect(page.locator(".capi-managed-key")).toContainText(prefix);
  await expect(page.locator(".capi-managed-key [data-action='revoke-custom-key']")).toBeVisible();

  const secureTitle = await page.locator(".capi-secure-note b").boundingBox();
  const secureDescription = await page.locator(".capi-secure-note small").boundingBox();
  expect(secureTitle && secureDescription && secureTitle.y + secureTitle.height <= secureDescription.y + 1).toBe(true);
  await page.screenshot({ path: ".codex-artifacts/custom-api-created-and-managed.png", fullPage: true });

  await page.locator(".capi-managed-key [data-action='revoke-custom-key']").click();
  await page.locator("[data-action='confirm-revoke-custom-key']").click();
  await expect(page.locator(".capi-managed-key.is-revoked")).toBeVisible();
  await expect(page.locator(".capi-managed-key.is-revoked")).toContainText("ملغى");
});
