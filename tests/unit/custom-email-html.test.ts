import { describe, expect, it } from "vitest";
import { inspectCustomEmailHtml, supportedEmailContentMode, supportedEmailDesign } from "../../src/lib/email/custom-email-html.js";
import { renewalReminderEmail } from "../../src/lib/email/templates/renewal-reminder.js";

describe("custom email HTML", () => {
  it("keeps email-safe layout markup and removes unsupported attributes", () => {
    const result = inspectCustomEmailHtml('<section dir="rtl" onclick="alert(1)" style="padding:20px;position:fixed"><h2>مرحبًا</h2><a href="{{renewal_link}}" target="_blank">تجديد</a></section>');
    expect(result.ok).toBe(true);
    expect(result.html).toContain('href="{{renewal_link}}"');
    expect(result.html).toContain("padding:20px");
    expect(result.html).not.toContain("onclick");
    expect(result.html).not.toContain("position");
    expect(result.html).toContain('rel="noopener noreferrer"');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("rejects executable markup and incomplete HTML", () => {
    expect(inspectCustomEmailHtml("<script>alert(1)</script>").ok).toBe(false);
    expect(inspectCustomEmailHtml("<div><strong>ناقص</div>").ok).toBe(false);
    expect(inspectCustomEmailHtml('<a href="javascript:alert(1)">رابط</a>').html).not.toContain("javascript:");
  });

  it("renders an explicitly adopted custom renewal design and escapes customer data", () => {
    const email = renewalReminderEmail({
      customerName: "<img src=x onerror=alert(1)>",
      renewalLink: "https://renvix.app/r/secure",
      template: {
        emailContentMode: "html",
        emailDesign: "premium",
        emailHtmlContent: '<section style="padding:20px"><h2>مرحبًا {{customer_name}}</h2><a href="{{renewal_link}}">جدد الآن</a></section>'
      }
    });
    expect(email.html).toContain("مرحبًا &lt;img src=x onerror=alert(1)&gt;");
    expect(email.html).toContain('href="https://renvix.app/r/secure"');
    expect(email.html).not.toContain("<img src=x");
  });

  it("renders the supported renewal and support links in custom email HTML", () => {
    const email = renewalReminderEmail({
      customerName: "سارة",
      serviceName: "Business",
      endDate: "2026-09-01",
      renewalLink: "https://renvix.app/r/secure",
      supportUrl: "https://renvix.app/support",
      template: {
        emailContentMode: "html",
        emailHtmlContent: '<section><p>{{customer_name}} · {{plan_name}} · {{expiry_date}}</p><a href="{{renewal_url}}">تجديد</a><a href="{{support_url}}">الدعم</a></section>'
      }
    });
    expect(email.html).toContain("سارة · Business · 2026-09-01");
    expect(email.html).toContain('href="https://renvix.app/r/secure"');
    expect(email.html).toContain('href="https://renvix.app/support"');
    expect(email.html).not.toContain("{{support_url}}");
  });

  it("normalizes unsupported modes and designs", () => {
    expect(supportedEmailContentMode("script")).toBe("preset");
    expect(supportedEmailDesign("editorial")).toBe("editorial");
    expect(supportedEmailDesign("executive")).toBe("executive");
    expect(supportedEmailDesign("copied-page")).toBe("classic");
  });
});
