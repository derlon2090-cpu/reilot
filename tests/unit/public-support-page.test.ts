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

  it("renders five actionable guides with distinct steps", () => {
    for (const id of ["quick-start", "subscriptions", "integrations", "billing", "reports"]) {
      expect(supportPageSource).toContain(`id: "${id}"`);
      expect(supportPageSource).toContain(`support-guide-${"${guide.id}"}`);
    }
    expect(supportPageSource).toContain("أكمل بيانات الحساب والمتجر من الإعدادات.");
    expect(supportPageSource).toContain("حدد قناة الإرسال؛ رقم واتساب إلزامي");
    expect(supportPageSource).toContain("راجع سجل التسليم والأخطاء قبل اتخاذ إجراء.");
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

  it("opens help content in-page instead of showing a fake success toast", () => {
    expect(appSource).toContain("guide.open = true");
    expect(appSource).toContain("guide.scrollIntoView");
    expect(appSource).not.toContain("toast(`تم فتح قسم ${target.dataset.term}`)");
  });

  it("keeps guide content full-width and responsive", () => {
    expect(stylesSource).toContain(".support-guides { grid-column: 1 / -1; }");
    expect(stylesSource).toContain(".support-guides-list { display: grid;");
    expect(stylesSource).toContain(".support-guides-list details[open]");
  });
});
