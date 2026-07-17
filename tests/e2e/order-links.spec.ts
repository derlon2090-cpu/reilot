import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

async function openOrderLinksWorkspace(page) {
  await page.goto("/");
  await expect(page.locator("[data-link='/features']").first()).toBeVisible();
  await page.evaluate(() => {
    history.pushState({}, "", "/dashboard/order-links");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}

const profile = {
  storeName: "متجر التقنية الذكية",
  slug: "tech-store",
  defaultTemplateStyle: "classic",
  defaultThemeColor: "#2563EB",
  isActive: true
};

const subscription = {
  id: "sub-1",
  orderNumber: "54981",
  planName: "Pro Plan",
  serviceName: "اشتراك احترافي",
  startDate: "2026-07-05",
  endDate: "2026-08-05",
  status: "active",
  customerId: "customer-1",
  customerName: "محمد السعيد",
  email: "test@example.com",
  phoneNumber: "966551710581"
};

test("order information builder and public page are responsive and private", async ({ page }) => {
  await mkdir(".codex-artifacts", { recursive: true });
  await page.route("**/api/dashboard/overview", (route) => route.fulfill({ json: { ok: true, stats: {}, profile: {} } }));
  await page.route("**/api/customers", (route) => route.fulfill({ json: { ok: true, items: [] } }));
  await page.route("**/api/order-link/profile", (route) => route.fulfill({ json: { ok: true, profile } }));
  await page.route("**/api/order-link/templates", (route) => route.fulfill({ json: { ok: true, items: [{
    id: "template-1",
    name: "قالب معلومات الطلب الاحترافي",
    style: "classic",
    themeColor: "#22C55E",
    storeName: profile.storeName,
    headerText: "مرحبًا بك في صفحة متابعة طلبك",
    footerText: "RenewPilot AI",
    additionalNotes: [],
    visibleFields: {},
    isDefault: true,
    updatedAt: "2026-07-17T10:30:00.000Z"
  }] } }));
  await page.route("**/api/order-link/subscriptions", (route) => route.fulfill({ json: { ok: true, items: [subscription] } }));
  await page.route("**/api/order-link/list", (route) => route.fulfill({
    json: {
      ok: true,
      items: [{
        id: "link-1",
        orderNumber: "54981-LONG-ORDER-NUMBER",
        customerName: "محمد السعيد صاحب اسم طويل للاختبار",
        templateName: "قالب معلومات الطلب الاحترافي",
        themeColor: "#22C55E",
        sendMethod: "copy",
        status: "active",
        openedCount: 12,
        lastOpenedAt: "2026-07-17T10:35:00.000Z",
        createdAt: "2026-07-17T10:30:00.000Z",
        publicUrl: "https://reilot.vercel.app/o/tech-store?t=publictoken123"
      }],
      stats: { activeTemplates: 1, sentLinks: 1, openedLinks: 1, todayRequests: 12, openRate: 100 },
      capabilities: { whatsappConnected: false, hasCustomerEmail: true }
    }
  }));
  await page.route("**/api/public/order-link/tech-store**", (route) => {
    const requestUrl = new URL(route.request().url());
    if (!requestUrl.searchParams.get("orderNumber")) {
      return route.fulfill({
        json: {
          ok: true,
          presentation: {
            store: { name: profile.storeName, slug: profile.slug, logoUrl: null },
            template: {
              style: "classic",
              themeColor: "#22C55E",
              headerText: "مرحبًا بك في صفحة متابعة طلبك",
              footerText: "RenewPilot AI"
            }
          }
        }
      });
    }
    return route.fulfill({
      json: {
        ok: true,
        data: {
        store: { name: profile.storeName, slug: profile.slug, logoUrl: null, supportPhone: "966551710581" },
        order: {
          orderNumber: "54981",
          customerName: "محمد السعيد",
          maskedPhone: null,
          planName: "Pro Plan",
          serviceName: "اشتراك احترافي",
          status: "active",
          startDate: "2026-07-05",
          endDate: "2026-08-05",
          remaining: { days: 20, state: "remaining" }
        },
        template: {
          name: "الأساسي",
          style: "classic",
          themeColor: "#22C55E",
          headerText: "شكرًا لاختيارك خدماتنا",
          footerText: "RenewPilot AI",
          additionalNotes: ["احتفظ بهذا الرابط للرجوع إليه لاحقًا.", "يمكنك التواصل معنا في أي وقت."],
          visibleFields: {
            customerName: true,
            planName: true,
            startDate: true,
            endDate: true,
            remainingDays: true,
            status: true,
            storeName: true,
            additionalNotes: true,
            phoneNumber: false
          }
        }
        }
      }
    });
  });

  await openOrderLinksWorkspace(page);

  await expect(page.locator(".page-title h1")).toContainText("إرسال معلومات الطلب");
  await expect(page.locator(".order-preview-slide.active .order-lookup-preview")).toContainText(profile.storeName);
  await page.locator("[data-order-field='storeName']").fill("متجر التقنية المتقدم");
  await expect(page.locator(".order-preview-slide.active .order-lookup-preview")).toContainText("متجر التقنية المتقدم");
  await page.locator("[data-order-field='subscriptionId']").selectOption("sub-1");
  await page.locator("[data-action='order-preview-step'][data-direction='1']").click();
  await expect(page.locator(".order-preview-slide.active .order-customer-card")).toBeVisible();
  await expect(page.locator("#order-live-preview .order-customer-card")).toContainText("محمد السعيد");
  await expect(page.getByRole("button", { name: "إرسال للعميل" })).toBeEnabled();
  await page.locator("[data-action='order-preview-step'][data-direction='-1']").click();
  await expect(page.locator(".order-preview-slide.active .order-lookup-preview")).toBeVisible();
  await expect(page.locator(".order-links-table-card--links")).toContainText("54981-LONG-ORDER-NUMBER");
  await expect(page.locator(".order-links-table-card--templates")).toContainText("قالب معلومات الطلب الاحترافي");
  expect(await page.locator(".order-links-table-card--links .compare").evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

  await page.screenshot({ path: ".codex-artifacts/order-links-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.screenshot({ path: ".codex-artifacts/order-links-mobile.png", fullPage: true });

  await page.setViewportSize({ width: 1500, height: 980 });
  await page.goto("/o/tech-store?t=publictoken123");

  await expect(page.locator(".public-order-entry .public-order-lookup-card")).toBeVisible();
  await expect(page.locator(".public-order-entry")).toContainText(profile.storeName);
  await expect(page.locator(".public-order-entry .order-themed-action")).toHaveCSS("background-color", "rgb(34, 197, 94)");
  await expect(page.locator("body")).not.toContainText("محمد السعيد");
  await expect(page.locator(".public-order-result")).toHaveCount(0);
  await page.screenshot({ path: ".codex-artifacts/public-order-entry-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.screenshot({ path: ".codex-artifacts/public-order-entry-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1500, height: 980 });
  await page.locator("[data-submit='public-order-search'] [name='orderNumber']").fill("54981");
  await page.locator("[data-submit='public-order-search'] button").click();
  await expect(page.locator(".public-order-result .order-customer-card")).toContainText("#54981");
  await expect(page.locator(".public-order-result")).toContainText("محمد السعيد");
  await expect(page.locator("body")).not.toContainText("customer-1");
  await expect(page.locator("body")).not.toContainText("sub-1");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.screenshot({ path: ".codex-artifacts/public-order-desktop.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.screenshot({ path: ".codex-artifacts/public-order-mobile.png", fullPage: true });
});

test("manual customer order creates a custom public link and updates the live preview", async ({ page }) => {
  const customer = {
    id: "customer-manual-1",
    name: "محمد السعيد",
    phone: "966551710581",
    email: "customer@example.com",
    status: "active",
    subscriptionCount: 0
  };
  let createdSubscriptionBody: Record<string, unknown> | null = null;
  let createdLinkBody: Record<string, unknown> | null = null;
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (value: string) => { (window as Window & { __copiedOrderLink?: string }).__copiedOrderLink = value; } }
    });
  });

  await page.route("**/api/dashboard/overview", (route) => route.fulfill({ json: { ok: true, stats: {}, profile: {} } }));
  await page.route("**/api/customers", (route) => route.fulfill({ json: { ok: true, items: [customer] } }));
  await page.route("**/api/order-link/profile", async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      return route.fulfill({ status: 200, json: { ok: true, profile: { ...profile, ...body, slug: "liong-d" } } });
    }
    return route.fulfill({ json: { ok: true, profile: { ...profile, slug: "liong-d" } } });
  });
  await page.route("**/api/order-link/templates", async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      return route.fulfill({ status: 201, json: { ok: true, item: { id: "template-manual-1", ...body } } });
    }
    return route.fulfill({ json: { ok: true, items: [] } });
  });
  await page.route("**/api/order-link/subscriptions", (route) => route.fulfill({ json: { ok: true, items: [] } }));
  await page.route("**/api/order-link/list", (route) => route.fulfill({
    json: {
      ok: true,
      items: [],
      stats: { activeTemplates: 0, sentLinks: 0, openedLinks: 0, todayRequests: 0, openRate: 0 },
      capabilities: { whatsappConnected: false, hasCustomerEmail: true }
    }
  }));
  await page.route("**/api/subscriptions", async (route) => {
    if (route.request().method() !== "POST") return route.fulfill({ json: { ok: true, items: [] } });
    createdSubscriptionBody = route.request().postDataJSON();
    return route.fulfill({ status: 201, json: { ok: true, item: { id: "subscription-manual-1", orderNumber: "RP-MANUAL-1" } } });
  });
  await page.route("**/api/order-link/create", async (route) => {
    createdLinkBody = route.request().postDataJSON();
    return route.fulfill({
      status: 201,
      json: {
        ok: true,
        id: "link-manual-1",
        orderNumber: "RP-MANUAL-1",
        publicUrl: "https://reilot.vercel.app/o/liong-d?t=secure-token"
      }
    });
  });
  await page.route("**/api/order-link/link-manual-1/send", (route) => route.fulfill({ json: { ok: true } }));

  await openOrderLinksWorkspace(page);

  await expect(page.locator(".order-preview-slide.active .order-lookup-preview")).toBeVisible();
  await page.locator("[data-action='order-color'][data-value='#22C55E']").click();
  await expect(page.locator(".order-preview-slide.active .order-lookup-preview")).toHaveAttribute("style", /#22C55E/);

  await page.locator("[data-action='order-source-mode'][data-value='manual']").click();
  await page.locator("[data-order-field='customerId']").selectOption(customer.id);
  await page.locator("[data-order-field='manualServiceName']").fill("اشتراك المنصة");
  await page.locator("[data-order-field='manualPlanName']").fill("Pro Plan");
  const startDate = page.locator("[data-order-field='manualStartDate']");
  const today = await page.evaluate(() => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  });
  await expect(startDate).toHaveValue(today);
  await expect(startDate).toHaveAttribute("readonly", "");
  await page.locator("[data-action='toggle-manual-start-date']").click();
  await expect(startDate).not.toHaveAttribute("readonly", "");
  await page.locator("[data-order-field='manualStartDate']").fill("2026-07-16");
  await page.locator("[data-order-field='manualEndDate']").fill("2026-08-16");

  await page.locator("[data-action='order-preview-show-result']").click();
  await expect(page.locator(".order-preview-slide.active .order-customer-card")).toContainText(customer.name);
  await expect(page.locator(".manual-order-result")).toContainText("نشط");
  await expect(page.locator("[data-action='create-order-link']")).toBeEnabled();
  await expect(page.locator("[data-action='copy-created-order-link']").first()).toBeEnabled();
  await page.locator("[data-action='copy-created-order-link']").first().click();

  await expect(page.locator(".created-link-box input")).toHaveValue(/\/o\/liong-d\?t=/);
  await expect.poll(() => page.evaluate(() => (window as Window & { __copiedOrderLink?: string }).__copiedOrderLink || "")).toContain("/o/liong-d?t=secure-token");
  expect(createdSubscriptionBody).toMatchObject({
    customerId: customer.id,
    serviceName: "اشتراك المنصة",
    planName: "Pro Plan",
    status: "active"
  });
  expect(createdLinkBody).toMatchObject({
    subscriptionId: "subscription-manual-1",
    templateId: "template-manual-1"
  });
  await mkdir(".codex-artifacts", { recursive: true });
  await page.screenshot({ path: ".codex-artifacts/order-links-manual-created.png", fullPage: true });
});
