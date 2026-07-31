import { describe, expect, it } from "vitest";
import { supportReplyEmail } from "../../src/lib/email/templates/support-reply.js";

describe("support reply email", () => {
  it("includes the real ticket context in text and subject", () => {
    const email = supportReplyEmail({
      requesterName: "وليد",
      ticketNumber: "SUP-2026-000123",
      ticketSubject: "ربط واتساب",
      replyBody: "تمت مراجعة طلبك ويمكنك إعادة محاولة الربط."
    });
    expect(email.subject).toContain("SUP-2026-000123");
    expect(email.subject).toContain("ربط واتساب");
    expect(email.text).toContain("تمت مراجعة طلبك");
    expect(email.text).toContain("support@renvix.app");
  });

  it("escapes untrusted content before inserting it into HTML", () => {
    const email = supportReplyEmail({
      requesterName: '<img src=x onerror="alert(1)">',
      ticketNumber: "SUP-1",
      ticketSubject: "<script>subject</script>",
      replyBody: "<script>alert(1)</script>\nسطر جديد"
    });
    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<img src=x");
    expect(email.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;<br>");
  });
});
