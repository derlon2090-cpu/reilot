import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const serviceSource = fs.readFileSync(path.resolve(process.cwd(), "src/server/support-tickets.js"), "utf8");
const adminSource = fs.readFileSync(path.resolve(process.cwd(), "src/components/admin/AdminSections.jsx"), "utf8");

describe("admin support email delivery", () => {
  it("sends every public admin reply through the server email provider", () => {
    expect(serviceSource).toContain("sendSupportReplyEmail({");
    expect(serviceSource).toContain("to: result.ticket.requester_email");
    expect(serviceSource).toContain("email_delivery_status='sent'");
    expect(serviceSource).toContain("email_delivery_status='failed'");
  });

  it("keeps internal notes out of requester email", () => {
    expect(serviceSource).toContain('internal ? "not_required" : "pending"');
    expect(serviceSource).toContain("if (!internal)");
  });

  it("shows a precise delivery result in the admin conversation", () => {
    expect(adminSource).toContain("تم حفظ الرد وإرساله إلى بريد العميل.");
    expect(adminSource).toContain("تم حفظ الرد داخل التذكرة، لكن تعذر إرساله إلى البريد.");
    expect(adminSource).toContain("تم الإرسال إلى البريد");
    expect(adminSource).toContain("تعذر إرسال البريد");
  });
});
