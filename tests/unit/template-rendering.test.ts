import { describe, expect, it } from "vitest";
import { findTemplateVariables, renderTemplate, validateMessagePayload } from "../../src/lib/templateRendering.js";
import { renewalReminderEmail } from "../../src/lib/email/templates/renewal-reminder.js";

describe("template rendering", () => {
  it("renders all variables and rejects unresolved templates", () => {
    const template = "مرحبًا {{customer_name}}، اشتراكك في {{service_name}} سينتهي بعد {{days}} أيام. رابط التجديد: {{renewal_url}}";
    const rendered = renderTemplate(template, {
      customer_name: "أحمد",
      service_name: "Canva Pro",
      days: 3,
      renewal_url: "https://renew.test/pay/1"
    });

    expect(findTemplateVariables(template)).toEqual(["customer_name", "service_name", "days", "renewal_url"]);
    expect(rendered).toContain("أحمد");
    expect(rendered).not.toContain("{{");
    expect(() => renderTemplate(template, { customer_name: "أحمد" })).toThrow("Missing template variables");
  });

  it("blocks unsafe message payloads before sending", () => {
    expect(validateMessagePayload({ toNumber: "", body: "hello" }).ok).toBe(false);
    expect(validateMessagePayload({ toNumber: "966500000000", body: "hello {{name}}" }).ok).toBe(false);
    expect(validateMessagePayload({ toNumber: "966500000000", body: "hello" }).ok).toBe(true);
  });

  it("renders the saved Arabic email template safely with the approved variables", () => {
    const email = renewalReminderEmail({
      customerName: "أحمد <script>alert(1)</script>",
      serviceName: "Renvix Pro",
      endDate: "2026-08-01",
      remainingDays: 7,
      renewalLink: "https://renvix.app/renew/1",
      orderNumber: "RVX-1",
      template: {
        storeName: "متجر النجاح",
        title: "تذكير {{اسم_العميل}}",
        body: "مرحبًا {{اسم_العميل}}، اشتراك {{اسم_الخدمة}} ينتهي {{تاريخ_الانتهاء}}.",
        buttonLabel: "جدد الآن",
        footerText: "شكرًا لثقتك بنا",
        themeColor: "#0EA5A8"
      }
    });

    expect(email.subject).toContain("أحمد");
    expect(email.html).toContain("https://renvix.app/renew/1");
    expect(email.html).not.toContain("<script>alert(1)</script>");
    expect(email.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(email.text).not.toContain("{{");
  });

  it("does not render non-HTTPS renewal buttons", () => {
    const email = renewalReminderEmail({ renewalLink: "javascript:alert(1)" });
    expect(email.html).not.toContain("javascript:");
  });
});
