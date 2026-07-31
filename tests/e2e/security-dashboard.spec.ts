import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const score = {
  ok: true,
  overall: { score: 92, label: "قوية", status: "available", coverage: 100 },
  platform: { score: 98, label: "ممتازة", status: "available", coverage: 100 },
  accounts: { score: 97, label: "ممتازة", status: "available", coverage: 100 },
  sessions: {
    score: 96,
    label: "ممتازة",
    activeSessions: 2,
    items: [
      { id: "session-current", device: "Chrome · كمبيوتر", location: "192.168.*.*", lastActivityAt: "2026-07-31T12:00:00.000Z", current: true },
      { id: "session-mobile", device: "Safari · جوال", location: "10.10.*.*", lastActivityAt: "2026-07-31T10:00:00.000Z", current: false }
    ]
  },
  whatsapp: { healthScore: 100, score: 100, label: "ممتازة", status: "available", coverage: 100 },
  sending: {
    score: 96,
    label: "ممتازة",
    status: "available",
    coverage: 100,
    policies: [
      { title: "الفاصل الذكي بين الرسائل", detail: "300 ثانية مع نطاق عشوائي آمن", active: true, icon: "clock" },
      { title: "حدود الإرسال الآمنة", detail: "20 في الساعة · 100 في اليوم", active: true, icon: "send" },
      { title: "الكشف عن الرسائل المكررة", detail: "24 ساعة", active: true, icon: "reports" },
      { title: "الحماية عند ارتفاع الخطر", detail: "إيقاف وقائي تلقائي", active: true, icon: "security" },
      { title: "فحص القوالب قبل الإرسال", detail: "2 من 2 قوالب سليمة", active: true, icon: "template" }
    ]
  },
  risk: { score: 8, label: "منخفض", status: "available", issues: 0 },
  weeklySecurityTrend: [
    { date: "2026-07-25", score: 84 },
    { date: "2026-07-26", score: 87 },
    { date: "2026-07-27", score: 86 },
    { date: "2026-07-28", score: 90 },
    { date: "2026-07-29", score: 89 },
    { date: "2026-07-30", score: 91 },
    { date: "2026-07-31", score: 92 }
  ],
  securityAlerts: [{ title: "تم تسجيل دخول جديد", message: "تم تسجيل دخول موثوق إلى الحساب.", severity: "info", occurredAt: "2026-07-31T12:00:00.000Z", actionLabel: "عرض التفاصيل", actionUrl: "/dashboard/security", deliveryChannels: ["in_app"] }],
  criticalIssues: [],
  calculatedAt: "2026-07-31T12:00:00.000Z",
  lastUpdatedAt: "2026-07-31T12:00:00.000Z"
};

async function mockDashboard(page: Page) {
  await page.route("**/api/auth/session", (route) => route.fulfill({ json: { ok: true, user: { id: "user-1", name: "مستخدم رينفكس", role: "owner", mustChangePassword: false } } }));
  await page.route("**/api/dashboard/overview", (route) => route.fulfill({ json: { ok: true, stats: {}, profile: { name: "مستخدم رينفكس" } } }));
  await page.route("**/api/billing/message-usage", (route) => route.fulfill({ json: { ok: true, used: 0, limit: 100 } }));
  await page.route("**/api/notifications**", (route) => route.fulfill({ json: { ok: true, items: [], unreadCount: 0 } }));
  await page.route("**/api/security/score", (route) => route.fulfill({ json: score }));
  await page.route("**/api/settings/security/sessions", (route) => route.fulfill({ json: { ok: true, items: score.sessions.items } }));
}

test("security dashboard matches the RTL reference and keeps its actions functional", async ({ page }) => {
  await mkdir(".codex-artifacts", { recursive: true });
  await mockDashboard(page);
  await page.goto("/");
  await page.evaluate(() => {
    history.pushState({}, "", "/dashboard/security");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });

  await expect(page.getByRole("heading", { name: "الحماية والأمان", exact: true })).toBeVisible();
  await expect(page.locator(".security-reference-top > article")).toHaveCount(6);
  await expect(page.locator(".security-trend-chart")).toBeVisible();
  await expect(page.getByText("الجلسة الحالية", { exact: true })).toBeVisible();
  await expect(page.locator(".security-reference-policy-list > div")).toHaveCount(5);

  await page.getByRole("button", { name: "عرض سجل التنبيهات" }).click();
  await expect(page.getByRole("heading", { name: "سجل تنبيهات الحماية" })).toBeVisible();
  await expect(page.getByText("تم تسجيل دخول جديد", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "إغلاق", exact: true }).click();

  await page.getByRole("button", { name: "إدارة سياسة الإرسال" }).click();
  await expect(page.getByRole("heading", { name: "تطبيق الإعدادات الآمنة الموصى بها" })).toBeVisible();
  await page.getByRole("button", { name: "إلغاء", exact: true }).click();

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: ".codex-artifacts/security-dashboard-reference.png" });
});

test("security dashboard remains readable without horizontal overflow on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockDashboard(page);
  await page.goto("/");
  await page.evaluate(() => {
    history.pushState({}, "", "/dashboard/security");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page.getByRole("heading", { name: "الحماية والأمان", exact: true })).toBeVisible();
  const dimensions = await page.locator(".security-dashboard-page").evaluate((element) => ({ scrollWidth: element.scrollWidth, clientWidth: element.clientWidth }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  await page.screenshot({ path: ".codex-artifacts/security-dashboard-mobile.png", fullPage: true });
});
