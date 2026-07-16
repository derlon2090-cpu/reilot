import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

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
  await page.route("**/api/order-link/profile", (route) => route.fulfill({ json: { ok: true, profile } }));
  await page.route("**/api/order-link/templates", (route) => route.fulfill({ json: { ok: true, items: [] } }));
  await page.route("**/api/order-link/subscriptions", (route) => route.fulfill({ json: { ok: true, items: [subscription] } }));
  await page.route("**/api/order-link/list", (route) => route.fulfill({
    json: {
      ok: true,
      items: [],
      stats: { activeTemplates: 0, sentLinks: 0, openedLinks: 0, todayRequests: 0, openRate: 0 },
      capabilities: { whatsappConnected: false, hasCustomerEmail: true }
    }
  }));
  await page.route("**/api/public/order-link/tech-store/54981**", (route) => route.fulfill({
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
          themeColor: "#2563EB",
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
  }));

  await page.goto("/");
  await page.evaluate(() => {
    history.pushState({}, "", "/dashboard/order-links");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });

  await expect(page.locator(".page-title h1")).toContainText("إرسال معلومات الطلب");
  await page.locator("[data-order-field='subscriptionId']").selectOption("sub-1");
  await expect(page.locator("#order-live-preview .order-customer-card")).toContainText("محمد السعيد");
  await expect(page.getByRole("button", { name: "إرسال للعميل" })).toBeDisabled();
  await expect(page.locator(".table-card").first()).toContainText("لا توجد روابط مرسلة بعد");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

  await page.screenshot({ path: ".codex-artifacts/order-links-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.screenshot({ path: ".codex-artifacts/order-links-mobile.png", fullPage: true });

  await page.setViewportSize({ width: 1500, height: 980 });
  await page.evaluate(() => {
    history.pushState({}, "", "/o/tech-store/54981?t=publictoken123");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });

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
