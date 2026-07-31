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
  it("links articles to the blog and questions to the same page", () => {
    expect(supportPageSource).toContain('data-link="/blog"');
    expect(supportPageSource).toContain('href="/support#faq"');
  });

  it("renders five actionable guides that open dedicated articles", () => {
    const slugs = [
      "quick-start-guide",
      "subscription-management-guide",
      "integrations-settings-guide",
      "billing-payments-guide",
      "reports-analytics-guide"
    ];
    for (const [index, id] of ["quick-start", "subscriptions", "integrations", "billing", "reports"].entries()) {
      expect(supportPageSource).toContain(`id: "${id}"`);
      expect(supportPageSource).toContain(`slug: "${slugs[index]}"`);
      expect(appSource).toContain(`slug: "${slugs[index]}"`);
    }
    expect(supportPageSource).toContain("أكمل بيانات الحساب والمتجر من الإعدادات.");
    expect(supportPageSource).toContain("حدد قناة الإرسال؛ رقم واتساب إلزامي");
    expect(supportPageSource).toContain("راجع سجل التسليم والأخطاء قبل اتخاذ إجراء.");
    expect(supportPageSource).toContain('data-link="/blog/${guide.slug}"');
  });

  it("contains distinct FAQ answers instead of the old repeated placeholder", () => {
    expect(supportPageSource).toContain("Renvix منصة لإدارة العملاء والاشتراكات");
    expect(supportPageSource).toContain("لن يبدأ الإرسال قبل اكتمال الاتصال");
    expect(supportPageSource).toContain("يرسل فريق الدعم الرد إلى البريد");
    expect(supportPageSource).not.toContain("ستجد الخطوات داخل مركز المساعدة، ويمكن لفريق الدعم مساعدتك");
  });

  it("posts public requests and support conversations to the real endpoint", () => {
    expect(supportPageSource).toContain('data-submit="support-request"');
    expect(appSource).toContain('data-submit="support-chat"');
    expect(appSource).toContain('fetchJson("/api/public/support/tickets"');
    expect(appSource).toContain("payload.item?.ticketNumber");
  });

  it("restores the compact help-center layout without the expanded guides block", () => {
    expect(supportPageSource).toContain('class="card help-center"');
    expect(supportPageSource).not.toContain('class="card support-guides"');
    expect(supportPageSource).not.toContain("support-guide-${guide.id}");
    expect(appSource).not.toContain("toast(`تم فتح قسم ${target.dataset.term}`)");
  });

  it("adds a professional cover and complete content for every help article", () => {
    for (const asset of ["help-quick-start.png", "help-subscriptions.png", "help-integrations.png", "help-billing.png", "help-reports.png"]) {
      expect(appSource).toContain(`/assets/blog/${asset}`);
    }
    expect(appSource.match(/category: "أدلة المساعدة"/g)).toHaveLength(5);
    expect(appSource).toContain("دليل البدء السريع في Renvix");
    expect(appSource).toContain("إدارة الاشتراكات باحتراف");
    expect(appSource).toContain("دليل التكاملات والإعدادات الآمنة");
    expect(appSource).toContain("فهم الفوترة والدفع والباقات");
    expect(appSource).toContain("قراءة التقارير والتحليلات");
    expect(stylesSource).toContain(".article-cover");
  });
});
