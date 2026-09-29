import { expect, test } from "@playwright/test";

test("support center opens dedicated help articles and keeps distinct FAQs", async ({ page }) => {
  await page.goto("/support");
  await expect(page.getByRole("heading", { name: "كيف نقدر نساعدك اليوم؟", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "تصفح حسب الفئة", exact: true })).toBeVisible();
  await expect(page.locator("#faq")).toContainText("Renvix منصة لإدارة العملاء والاشتراكات");
  await expect(page.locator("#faq")).toContainText("لن يبدأ الإرسال قبل اكتمال الاتصال");

  await page.getByRole("button", { name: /البدء السريع/ }).click();
  await expect(page).toHaveURL(/\/blog\/quick-start-guide$/);
  await expect(page.getByRole("heading", { name: /دليل البدء السريع في Renvix/ })).toBeVisible();
  await expect(page.locator(".article-cover")).toHaveAttribute("src", "/assets/blog/help-quick-start.png");
  await expect(page.locator(".article-content")).toContainText("أكمل هوية الحساب والمتجر");
});

test("support search exposes an accessible direct link to a matching guide", async ({ page }) => {
  await page.goto("/support");
  await page.getByPlaceholder("ابحث عن موضوع أو سؤال...").fill("التكاملات");
  const result = page.getByRole("button", { name: "اقرأ دليل التكاملات والإعدادات" });
  await expect(result).toBeVisible();
  await result.click();
  await expect(page).toHaveURL(/\/blog\/integrations-settings-guide$/);
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
  const answers = page.locator(".pricing-faq-answer p");
  await expect(answers).toHaveCount(6);
  const texts = (await answers.allTextContents()).map((text) => text.trim());
  expect(new Set(texts).size).toBe(6);
  expect(texts.join(" ")).toContain("البريد الإلكتروني وقنوات واتساب الرسمية بشكل مستقل");
  expect(texts.join(" ")).toContain("إلغاء التجديد");
  expect(texts.join(" ")).toContain("API");
});
