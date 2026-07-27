import { describe, expect, it } from "vitest";
import {
  SALLA_TEMPLATE_DEFINITIONS,
  SALLA_TEMPLATE_KEYS,
  normalizeSallaTemplateEvent,
  previewSallaAutomationTemplate,
  renderSallaTemplate
} from "../../src/server/salla-templates.js";

describe("Salla automation templates", () => {
  it("defines exactly one immutable record key for every required template", () => {
    const keys = SALLA_TEMPLATE_DEFINITIONS.map((item) => item.key);
    expect(keys).toHaveLength(10);
    expect(new Set(keys).size).toBe(10);
    expect(keys).toEqual(expect.arrayContaining(Object.values(SALLA_TEMPLATE_KEYS)));
  });

  it("keeps completed and invoice templates independent", () => {
    const completed = SALLA_TEMPLATE_DEFINITIONS.find((item) => item.key === SALLA_TEMPLATE_KEYS.COMPLETED);
    const invoice = SALLA_TEMPLATE_DEFINITIONS.find((item) => item.key === SALLA_TEMPLATE_KEYS.INVOICE_READY);
    expect(completed?.triggerType).toBe("order_status");
    expect(invoice?.triggerType).toBe("invoice_event");
    expect(invoice?.eventName).toBe("invoice.created");
  });

  it("normalizes tenant-neutral identifiers from a Salla event", () => {
    const event = normalizeSallaTemplateEvent({
      id: "evt-1",
      event: "order.status.updated",
      merchant: 991,
      data: {
        id: 440,
        status: { id: 7, slug: "shipped" }
      }
    });
    expect(event).toMatchObject({
      externalEventId: "evt-1",
      eventName: "order.status.updated",
      storeId: "991",
      orderId: "440",
      statusId: "7",
      statusSlug: "shipped"
    });
    expect(event).not.toHaveProperty("tenantId");
  });

  it("renders only supplied values and strips unresolved whitespace", () => {
    const rendered = renderSallaTemplate(
      "مرحبًا {{customer_name}}\n\n{{tracking_number}}\n\nشكرًا",
      { customer_name: "وليد" }
    );
    expect(rendered).toContain("وليد");
    expect(rendered).not.toContain("{{customer_name}}");
    expect(rendered).not.toContain("{{tracking_number}}");
  });

  it("marks preview output as non-delivery data", () => {
    const preview = previewSallaAutomationTemplate({
      channel: "whatsapp",
      messageBody: "مرحبًا {{customer_name}}",
      emailSubject: null
    });
    expect(preview.body).toContain("أحمد");
    expect(preview.notice).toContain("معاينة فقط");
  });
});
