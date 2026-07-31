import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../../src/app/app.js", import.meta.url), "utf8");
const policySource = appSource.slice(
  appSource.indexOf("function policyPage()"),
  appSource.indexOf("function authPublicPage()")
);

describe("Renvix public policies", () => {
  it("identifies Renvix and both official website domains", () => {
    expect(policySource).toContain("سياسة الخصوصية - رينفكس");
    expect(policySource).toContain("سياسة الاستخدام - رينفكس");
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

  it("preserves statutory refund and delayed-delivery protections", () => {
    expect(policySource).toContain("حق الإلغاء خلال سبعة أيام");
    expect(policySource).toContain("إذا لم يستخدم الخدمة ولم ينتفع بها");
    expect(policySource).toContain("أكثر من خمسة عشر يومًا");
    expect(policySource).toContain("دون الانتقاص من الحقوق المقررة نظامًا");
  });

  it("uses the Renvix support address and a precise update date", () => {
    expect(policySource).toContain("support@renvix.app");
    expect(policySource).toContain("آخر تحديث: 31 يوليو 2026");
    expect(policySource).toContain("Last updated: July 31, 2026");
  });
});
