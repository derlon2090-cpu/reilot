import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const appSource = fs.readFileSync(path.resolve(process.cwd(), "src/app/app.js"), "utf8");
const pricingSource = appSource.slice(
  appSource.indexOf("function marketingPricingPage()"),
  appSource.indexOf("function blogPage()")
);
const faqSource = appSource.slice(
  appSource.indexOf("function pricingFaqSection("),
  appSource.indexOf("function marketingPricingPage()")
);

describe("public pricing FAQ", () => {
  it("provides all six approved questions with practical distinct answers", () => {
    expect(pricingSource).toContain("يمكنك الترقية إلى باقة أعلى أو التبديل إلى باقة أخرى بسهولة");
    expect(pricingSource).toContain("يتم احتساب استخدام البريد الإلكتروني وقنوات واتساب الرسمية بشكل مستقل");
    expect(pricingSource).toContain("وتستمر الباقة الحالية حتى نهاية مدتها دون تجديد تلقائي");
    expect(pricingSource).toContain("يتم احتساب الرسائل بحسب نوع القناة المستخدمة وحجم الإرسال");
    expect(pricingSource).toContain("هل يتوفر دعم فني؟");
    expect(pricingSource).toContain("هل تتوفر واجهة برمجة تطبيقات (API)؟");
    expect(pricingSource).toContain("pricingFaqSection(questions)");
  });

  it("uses an accessible single-open accordion instead of native details", () => {
    expect(faqSource).toContain('data-action="pricing-faq-toggle"');
    expect(faqSource).toContain('aria-expanded="${isOpen}"');
    expect(faqSource).toContain('aria-controls="${panelId}"');
    expect(faqSource).toContain('role="region"');
    expect(faqSource).not.toContain("<details>");
  });
});
