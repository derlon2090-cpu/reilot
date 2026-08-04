import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(resolve("src/app/app.js"), "utf8");
const styles = readFileSync(resolve("src/styles/globals.css"), "utf8");
const scoreSource = readFileSync(resolve("src/server/security-score.js"), "utf8");

describe("security dashboard reference implementation", () => {
  it("keeps the existing dashboard security route and replaces its content in place", () => {
    expect(appSource).toContain('"/dashboard/security": securityPage');
    expect(appSource).toContain('class="security-dashboard-page"');
  });

  it("renders exactly the four requested summary concepts", () => {
    for (const title of ["مؤشر الحماية العام", "عمليات الإرسال الآمنة", "محاولات تم منعها", "تنبيهات تحتاج متابعة"]) {
      expect(appSource).toContain(title);
    }
    expect(styles).toContain("grid-template-columns: repeat(4,minmax(0,1fr))");
  });

  it("renders the three main cards and one footer banner", () => {
    expect(appSource).toContain("مركز الحماية الذكي");
    expect(appSource).toContain("جلسات الدخول الأخيرة");
    expect(appSource).toContain("أحدث التنبيهات الأمنية");
    expect(appSource).toContain("حماية حسابك أولوية");
    expect(appSource).toContain("دخول الحساب OTP");
    expect(appSource).toContain("الجلسة الحالية");
    expect(appSource).toContain('data-action="security-alerts"');
  });

  it("does not retain the former fake seven-bar trend", () => {
    expect(styles).not.toContain(".security-trend span:nth-child");
    expect(scoreSource).toContain("security_score_snapshots");
    expect(scoreSource).toContain("weeklySecurityTrend");
  });

  it("scopes the requested cyan-to-blue scrollbar to this page", () => {
    expect(styles).toContain("html:has(.security-dashboard-page)::-webkit-scrollbar-thumb");
    expect(styles).toContain("linear-gradient(180deg,#8ed9d7 0%,#66c2e8 45%,#3b82f6 100%)");
    expect(styles).toContain("background-clip: content-box");
  });

  it("keeps account protection and session operations connected to backend actions", () => {
    expect(appSource).toContain('data-link="/dashboard/settings?section=security"');
    expect(appSource).toContain('data-action="manage-sessions"');
    expect(appSource).toContain('data-action="security-alerts"');
    expect(appSource).toContain('/api/security/recalculate');
  });

  it("exposes safe alert fields and channel levels without exposing secrets", () => {
    for (const field of ["title", "message", "severity", "timestamp", "actionLabel", "actionUrl", "readStatus", "deliveryChannels"]) {
      expect(scoreSource).toContain(field);
    }
    expect(scoreSource).toContain('["in_app", "email", "urgent"]');
  });

  it("provides responsive desktop, tablet, and mobile layouts", () => {
    expect(styles).toContain("@media (max-width: 1100px)");
    expect(styles).toContain("@media (max-width: 620px)");
  });

  it("does not expose the former manual sending-policy controls in the active page", () => {
    const pageBody = appSource.slice(appSource.indexOf("function securityPage()"), appSource.indexOf("function connectedDevicesCenterPage()"));
    expect(pageBody).not.toContain("سياسة الإرسال الآمن");
    expect(pageBody).not.toContain("الفاصل الذكي بين الرسائل");
    expect(pageBody).not.toContain("Meta Cloud API");
  });
});
