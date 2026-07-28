import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const appSource = fs.readFileSync(path.resolve(process.cwd(), "src/app/app.js"), "utf8");
const stylesSource = fs.readFileSync(path.resolve(process.cwd(), "src/styles/globals.css"), "utf8");
const supportPageSource = appSource.slice(
  appSource.indexOf("function marketingSupportPage()"),
  appSource.indexOf("function aboutPage()")
);

describe("public support page", () => {
  it("uses a dedicated icon for every support card and help-center topic", () => {
    expect(supportPageSource).toContain('"helpBook"');
    expect(supportPageSource).toContain('"faq"');
    expect(supportPageSource).toContain('"chat"');
    expect(supportPageSource).toContain('"email"');
    expect(supportPageSource).toContain('"البدء السريع": "rocket"');
    expect(supportPageSource).toContain('"إدارة الاشتراكات": "subscriptions"');
    expect(supportPageSource).toContain('"التكاملات والإعدادات": "puzzle"');
    expect(supportPageSource).toContain('"الفوترة والدفع": "payments"');
    expect(supportPageSource).toContain('"التقارير والتحليلات": "barChart"');
  });

  it("does not render the removed trust strip", () => {
    expect(supportPageSource).not.toContain("container trust-band");
    expect(supportPageSource).not.toContain("▢ آمن وموثوق");
    expect(supportPageSource).not.toContain("◇ خبراء المنتجات");
    expect(supportPageSource).not.toContain("♬ دعم على مدار الساعة");
    expect(supportPageSource).not.toContain("◷ متوسط الرد أقل من ساعتين");
  });

  it("keeps help-center icons in clear blue rounded tiles", () => {
    expect(stylesSource).toContain(".help-center .line-icon { width: 44px; height: 44px; min-width: 44px;");
    expect(stylesSource).toContain("display: block; flex: 0 0 44px;");
    expect(stylesSource).toContain("color: #1769ed; border: 1px solid #e2edff;");
  });
});
