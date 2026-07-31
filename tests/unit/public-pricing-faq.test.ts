import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const appSource = fs.readFileSync(path.resolve(process.cwd(), "src/app/app.js"), "utf8");
const pricingSource = appSource.slice(
  appSource.indexOf("function marketingPricingPage()"),
  appSource.indexOf("function blogPage()")
);

describe("public pricing FAQ", () => {
  it("provides a distinct practical answer for every pricing question", () => {
    expect(pricingSource).toContain("تُطبّق الترقية وفق السعر الظاهر قبل الدفع");
    expect(pricingSource).toContain("حد رسائل البريد مستقل");
    expect(pricingSource).toContain("يمكن إيقاف التجديد التلقائي للدورات القادمة");
    expect(pricingSource).toContain("بعد قبول مزود القناة لعملية الإرسال بنجاح");
    expect(pricingSource).toContain("questions.map(([question, answer])");
  });

  it("does not reuse the old generic answer", () => {
    expect(pricingSource).not.toContain("يمكنك إدارة خطتك بمرونة، ويُحتسب البريد وواتساب كلٌ على حدة وفق الرسائل الناجحة فعليًا.");
  });
});
