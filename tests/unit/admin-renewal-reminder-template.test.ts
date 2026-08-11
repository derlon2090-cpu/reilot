import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve("drizzle/0067_admin_subscription_renewal_reminder.sql"), "utf8");
const delivery = readFileSync(resolve("src/server/admin-template-events.js"), "utf8");
const samples = readFileSync(resolve("app/api/admin/templates/[templateKey]/samples/route.js"), "utf8");
const editor = readFileSync(resolve("src/components/admin/AdminTemplateEditor.jsx"), "utf8");

describe("admin subscription renewal reminder template", () => {
  it("seeds a professional editable system template with safe approved variables", () => {
    expect(migration).toContain("'admin_subscription_renewal_reminder'");
    expect(migration).toContain("'تذكير التجديد'");
    expect(migration).toContain("'email'");
    expect(migration).toContain("days_remaining");
    expect(migration).toContain("renewal_url");
    expect(migration).toContain("ON CONFLICT (template_key) DO NOTHING");
  });

  it("queues one reminder per subscription period and revalidates eligibility before delivery", () => {
    expect(delivery).toContain('"subscription.renewal_due": ADMIN_TEMPLATE_KEYS.SUBSCRIPTION_RENEWAL_REMINDER');
    expect(delivery).toContain("extract(epoch FROM ps.current_period_end)::bigint::text");
    expect(delivery).toContain("AND NOT EXISTS (");
    expect(delivery).toContain("ON CONFLICT (idempotency_key) DO NOTHING");
    expect(delivery).toContain("ps.status='active' AND ps.current_period_end > now()");
    expect(delivery).toContain('skip: "renewal_reminder_no_longer_due"');
    expect(delivery).toContain("/dashboard/billing");
  });

  it("supports real-data preview and readable variable labels in the shared admin editor", () => {
    expect(samples).toContain('templateKey === "admin_subscription_renewal_reminder"');
    expect(samples).toContain("days_remaining:");
    expect(editor).toContain('days_remaining: "الأيام المتبقية"');
    expect(editor).toContain('renewal_url: "رابط تجديد الاشتراك"');
  });
});
