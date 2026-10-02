import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../../src/app/app.js", import.meta.url), "utf8");
const sitemapSource = readFileSync(new URL("../../app/sitemap.js", import.meta.url), "utf8");
const policySource = appSource.slice(
  appSource.indexOf("function policyPage()"),
  appSource.indexOf("function authPublicPage()")
);

describe("Renvix public policies", () => {
  it("identifies Renvix and both official website domains", () => {
    expect(policySource).toContain("سياسة الخصوصية - رينفكس");
    expect(policySource).toContain("سياسة الاستخدام - رينفكس");
    expect(policySource).toContain("سياسة الحماية والاستخدام المقبول - رينفكس");
    expect(policySource).toContain("سياسة الاستبدال والاسترجاع - رينفكس");
    expect(policySource).toContain("renvix.app");
    expect(policySource).toContain("renvix.click");
  });

  it("documents the principal personal-data rights and processing roles", () => {
    expect(policySource).toContain("حقوق أصحاب البيانات");
    expect(policySource).toContain("طلب الوصول إلى بياناته");
    expect(policySource).toContain("العدول عن الموافقة");
    expect(policySource).toContain("دور رينفكس وبيانات عملائك");
    expect(policySource).toContain("لا نبيع البيانات الشخصية");
  });

  it("documents messaging consent and integration responsibilities", () => {
    expect(policySource).toContain("بيانات العملاء والموافقات");
    expect(policySource).toContain("حصل على الموافقات المطلوبة");
    expect(policySource).toContain("القنوات والتكاملات الخارجية");
    expect(policySource).toContain("مفاتيح API");
  });

  it("defines proportionate security enforcement and a permanent-ban appeal process", () => {
    expect(policySource).toContain("متى يصبح الحظر نهائيًا");
    expect(policySource).toContain("كيفية تنفيذ الحظر النهائي");
    expect(policySource).toContain("الاعتراض وطلب المراجعة");
    expect(policySource).toContain("تجنب حظر أشخاص غير مرتبطين بالمخالفة");
    expect(policySource).toContain("ولا يُعد ذلك تفويضًا مفتوحًا لجمع أي بيانات");
    expect(policySource).toContain("موافقة مستقلة متى كانت الموافقة مطلوبة نظامًا");
    expect(sitemapSource).toContain('"protection-policy"');
  });

  it("applies the requested first-subscription refund rules", () => {
    expect(policySource).toContain("خلال ٣ أيام");
    expect(policySource).toContain("الاشتراك المدفوع الأول");
    expect(policySource).toContain("لا ينطبق الاسترجاع على الاشتراكات المجدّدة");
    expect(policySource).toContain("٤٨ ساعة عمل");
    expect(policySource).toContain("٧ إلى ١٤ يوم عمل");
    expect(policySource).toContain("دون الإخلال بأي حق لا يجوز تقييده نظامًا");
  });

  it("states the non-refundable add-ons and direct Meta charges", () => {
    expect(policySource).toContain("واتساب الأعمال الرسمي (API)");
    expect(policySource).toContain("غير قابلة للاسترجاع أو الاستبدال أو النقل");
    expect(policySource).toContain("يدفعها العميل إلى Meta مباشرة");
    expect(policySource).toContain("محفظة المنصة لاشتراكات سلة وزد");
  });

  it("uses the Renvix support address and a precise update date", () => {
    expect(policySource).toContain("support@renvix.app");
    expect(policySource).toContain("31 يوليو 2026");
    expect(policySource).toContain("July 31, 2026");
    expect(policySource).toContain("14 أغسطس 2026");
    expect(policySource).toContain("August 14, 2026");
    expect(policySource).toContain("2 أكتوبر 2026");
    expect(policySource).toContain("October 2, 2026");
  });
});
