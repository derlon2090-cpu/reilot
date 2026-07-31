import { expect, test } from "@playwright/test";

test("support center opens dedicated help articles and keeps distinct FAQs", async ({ page }) => {
  await page.goto("/support");
  await expect(page.getByRole("heading", { name: "مركز الدعم" })).toBeVisible();
  await expect(page.locator(".support-guides")).toHaveCount(0);
  await expect(page.locator("#faq")).toContainText("Renvix منصة لإدارة العملاء والاشتراكات");
  await expect(page.locator("#faq")).toContainText("لن يبدأ الإرسال قبل اكتمال الاتصال");

  await page.locator('[data-link="/blog/quick-start-guide"]').click();
  await expect(page).toHaveURL(/\/blog\/quick-start-guide$/);
  await expect(page.getByRole("heading", { name: /دليل البدء السريع في Renvix/ })).toBeVisible();
  await expect(page.locator(".article-cover")).toHaveAttribute("src", "/assets/blog/help-quick-start.png");
  await expect(page.locator(".article-content")).toContainText("أكمل هوية الحساب والمتجر");
});

test("public support form sends a real ticket payload and shows its number", async ({ page }) => {
  let postedBody: Record<string, string> | undefined;
  await page.route("**/api/public/support/tickets", async (route) => {
    postedBody = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, item: { ticketNumber: "SUP-2026-000321" } })
    });
  });
  await page.goto("/support");
  const form = page.locator('form[data-submit="support-request"]');
  await form.locator('[name="name"]').fill("وليد علي");
  await form.locator('[name="email"]').fill("waleed@example.com");
  await form.locator('[name="type"]').selectOption("TECHNICAL_ISSUE");
  await form.locator('[name="subject"]').fill("مشكلة في ربط القناة");
  await form.locator('[name="details"]').fill("تظهر مشكلة عند محاولة إكمال عملية الربط من صفحة التطبيقات.");
  await form.getByRole("button", { name: "إرسال الطلب" }).click();

  await expect(page.getByText("رقم الطلب: SUP-2026-000321")).toBeVisible();
  expect(postedBody).toMatchObject({
    name: "وليد علي",
    email: "waleed@example.com",
    type: "TECHNICAL_ISSUE",
    subject: "مشكلة في ربط القناة",
    body: "تظهر مشكلة عند محاولة إكمال عملية الربط من صفحة التطبيقات."
  });
});

test("start conversation creates a support request and closes the drawer", async ({ page }) => {
  let postedBody: Record<string, string> | undefined;
  await page.route("**/api/public/support/tickets", async (route) => {
    postedBody = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, item: { ticketNumber: "SUP-2026-000322" } })
    });
  });
  await page.goto("/support");
  await page.locator('[data-action="open-chat"]').click();
  const form = page.locator('form[data-submit="support-chat"]');
  await expect(form).toBeVisible();
  await form.locator('[name="name"]').fill("زائر الموقع");
  await form.locator('[name="email"]').fill("visitor@example.com");
  await form.locator('[name="type"]').selectOption("INQUIRY");
  await form.locator('[name="subject"]').fill("استفسار عن الاشتراكات");
  await form.locator('[name="message"]').fill("أرغب بمعرفة طريقة إضافة أول اشتراك وتفعيل التذكير.");
  await form.getByRole("button", { name: "إرسال إلى فريق الدعم" }).click();

  await expect(form).toBeHidden();
  await expect(page.getByText("رقم الطلب: SUP-2026-000322")).toBeVisible();
  expect(postedBody?.body).toContain("إضافة أول اشتراك");
});

test("pricing FAQ shows a different practical answer for every question", async ({ page }) => {
  await page.goto("/pricing");
  const answers = page.locator(".faq-compact details p");
  await expect(answers).toHaveCount(4);
  const texts = (await answers.allTextContents()).map((text) => text.trim());
  expect(new Set(texts).size).toBe(4);
  expect(texts.join(" ")).toContain("حد رسائل البريد مستقل");
  expect(texts.join(" ")).toContain("إيقاف التجديد التلقائي");
  expect(texts.join(" ")).toContain("قبول مزود القناة");
});
