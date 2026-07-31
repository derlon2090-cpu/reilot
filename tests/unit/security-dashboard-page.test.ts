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

  it("renders the six reference overview cards", () => {
    for (const title of ["مؤشر الحماية العام", "حماية المنصة", "حماية الحساب", "أمان الإرسال", "صحة واتساب", "مستوى الخطر"]) {
      expect(appSource).toContain(title);
    }
  });

  it("renders real trend, policy, sessions, and alerts sections", () => {
    expect(appSource).toContain("securityTrendMarkup(score.weeklySecurityTrend");
    expect(appSource).toContain("إدارة سياسة الإرسال");
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
    expect(styles).toContain("linear-gradient(180deg,#63c8c6");
  });

  it("keeps policy and session operations connected to their existing backend actions", () => {
    expect(appSource).toContain('data-action="preview-safe-settings"');
    expect(appSource).toContain('data-action="manage-sessions"');
    expect(appSource).toContain('/api/security/apply-recommended');
    expect(appSource).toContain('/api/security/recalculate');
  });

  it("exposes safe alert fields and channel levels without exposing secrets", () => {
    for (const field of ["title", "message", "severity", "timestamp", "actionLabel", "actionUrl", "readStatus", "deliveryChannels"]) {
      expect(scoreSource).toContain(field);
    }
    expect(scoreSource).toContain('["in_app", "email", "urgent"]');
  });

  it("provides responsive desktop, tablet, and mobile layouts", () => {
    expect(styles).toContain("@media (max-width: 1180px)");
    expect(styles).toContain("@media (max-width: 820px)");
    expect(styles).toContain("@media (max-width: 520px)");
  });
});
