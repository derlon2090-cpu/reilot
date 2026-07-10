import { describe, expect, it } from "vitest";
import { findTemplateVariables, renderTemplate, validateMessagePayload } from "../../src/lib/templateRendering.js";

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
});
