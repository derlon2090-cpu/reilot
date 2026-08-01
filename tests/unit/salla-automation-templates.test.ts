import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  SALLA_TEMPLATE_DEFINITIONS,
  SALLA_TEMPLATE_KEYS,
  normalizeSallaTemplateEvent,
  previewSallaAutomationTemplate,
  renderSallaTemplate
} from "../../src/server/salla-templates.js";

const appSource = fs.readFileSync(path.resolve(process.cwd(), "src/app/app.js"), "utf8");
const styles = fs.readFileSync(path.resolve(process.cwd(), "src/styles/globals.css"), "utf8");
const serverSource = fs.readFileSync(path.resolve(process.cwd(), "src/server/salla-templates.js"), "utf8");
const resendSource = fs.readFileSync(path.resolve(process.cwd(), "src/server/email/resend.service.js"), "utf8");
const testRouteSource = fs.readFileSync(path.resolve(process.cwd(), "app/api/apps/salla/templates/[templateKey]/test/route.js"), "utf8");

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

  it("uses one activation control with a specific message title for every Salla template", () => {
    for (const definition of SALLA_TEMPLATE_DEFINITIONS) {
      expect(appSource).toContain(`${definition.key}: "تفعيل رسالة`);
    }
    expect(appSource).toContain('action: "salla-template-toggle"');
    expect(appSource).toContain("عند الإيقاف لن تُرسل الرسالة");
    expect(styles).toContain(".message-activation-card{min-height:66px");
    expect(styles).toContain(".message-activation-switch");
  });

  it("excludes disabled templates in the database query before any message is queued", () => {
    expect(serverSource).toContain("WHERE tenant_id=$1 AND is_enabled=true");
    expect(serverSource).toContain('reason: "template_disabled_or_unmapped"');
  });

  it("keeps an independent persisted delivery channel for every template", () => {
    expect(serverSource).toContain('delivery_channel AS channel');
    expect(serverSource).toContain('WHERE tenant_id=$1 AND template_key=$2');
    expect(serverSource).toContain('delivery_channel=$3');
    expect(appSource).toContain('name="channel" data-salla-channel-choice');
  });

  it("updates the preview immediately when a template channel changes", () => {
    expect(appSource).toContain("function refreshSallaTemplatePreview");
    expect(appSource).toContain('data-salla-preview-head="whatsapp"');
    expect(appSource).toContain('data-salla-preview-head="email"');
    expect(appSource).toContain("refreshSallaTemplatePreview(form)");
  });

  it("uses the saved store logo in every Salla email, including test deliveries", () => {
    expect(appSource).toContain('data-action="salla-email-logo-file"');
    expect(appSource).toContain('fetchJson("/api/order-link/profile/logo"');
    expect(serverSource).toContain('logo_url AS "logoUrl"');
    expect(serverSource).toContain("branding: {");
    expect(testRouteSource).toContain("payload.storeProfile?.logoUrl");
    expect(resendSource).toContain("branding.logoUrl || brandImageUrl");
    expect(styles).toContain(".salla-email-logo-editor");
  });

  describe.each(
    SALLA_TEMPLATE_DEFINITIONS.flatMap((definition) => ["whatsapp", "email"].map((channel) => ({
      definition,
      channel
    })))
  )("$definition.key through $channel", ({ definition, channel }) => {
    it("builds the correct independent channel preview", () => {
      const preview = previewSallaAutomationTemplate({
        channel,
        emailSubject: channel === "email" ? "طلبك {{order_number}}" : null,
        messageBody: definition.body
      });

      expect(preview.channel).toBe(channel);
      expect(preview.body.length).toBeGreaterThan(0);
      if (channel === "email") expect(preview.subject).toContain("#10025");
      else expect(preview.subject).toBeNull();
    });
  });
});
