import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  SALLA_TEMPLATE_DEFINITIONS,
  SALLA_TEMPLATE_KEYS,
  normalizeSallaTemplateEvent,
  paidDigitalDelivery,
  previewSallaAutomationTemplate,
  renderSallaTemplate,
  resolveSallaChannelContent
} from "../../src/server/salla-templates.js";

const appSource = fs.readFileSync(path.resolve(process.cwd(), "src/app/app.js"), "utf8");
const styles = fs.readFileSync(path.resolve(process.cwd(), "src/styles/globals.css"), "utf8");
const serverSource = fs.readFileSync(path.resolve(process.cwd(), "src/server/salla-templates.js"), "utf8");
const resendSource = fs.readFileSync(path.resolve(process.cwd(), "src/server/email/resend.service.js"), "utf8");
const testRouteSource = fs.readFileSync(path.resolve(process.cwd(), "app/api/apps/salla/templates/[templateKey]/test/route.js"), "utf8");

describe("Salla automation templates", () => {
  it("defines exactly one immutable record key for every required template", () => {
    const keys = SALLA_TEMPLATE_DEFINITIONS.map((item) => item.key);
    expect(keys).toHaveLength(12);
    expect(new Set(keys).size).toBe(12);
    expect(keys).toEqual(expect.arrayContaining(Object.values(SALLA_TEMPLATE_KEYS)));
  });

  it("keeps completion as a secure order-link message and preserves the invoice link path", () => {
    const completed = SALLA_TEMPLATE_DEFINITIONS.find((item) => item.key === SALLA_TEMPLATE_KEYS.COMPLETED);
    expect(completed?.triggerType).toBe("order_status");
    expect(completed?.body).toContain("{{order_url}}");
    expect(serverSource).toContain('key: "salla_invoice_ready"');
    expect(serverSource).toContain('? "invoice"');
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
    expect(appSource).toContain('name="channel" value="email" data-salla-channel-choice');
  });

  it("updates the preview immediately when a template channel changes", () => {
    expect(appSource).toContain("function refreshSallaTemplatePreview");
    expect(appSource).toContain('data-salla-preview-head="whatsapp"');
    expect(appSource).toContain('data-salla-preview-head="email"');
    expect(appSource).toContain("refreshSallaTemplatePreview(form)");
  });

  it("persists independent content for WhatsApp and email", () => {
    expect(serverSource).toContain('whatsapp_content AS "whatsappContent"');
    expect(serverSource).toContain('email_text_content AS "emailTextContent"');
    expect(serverSource).toContain("whatsapp_content=$11");
    expect(serverSource).toContain("email_text_content=$12");
    expect(appSource).toContain('name="whatsappContent"');
    expect(appSource).toContain('name="emailTextContent"');
  });

  it("requires paid digital content and rejects stale status events", () => {
    expect(serverSource).toContain("paidDigitalDelivery");
    expect(serverSource).toContain("digital.links.length");
    expect(serverSource).toContain("claimSallaEventWatermark");
    expect(serverSource).toContain("latest_event_at<=EXCLUDED.latest_event_at");
  });

  it.each([
    ["unpaid", { payment: { status: "pending" }, urls: { digital_content: "https://cdn.example.test/file" } }, false, 1],
    ["processing", { payment: { status: "processing" }, urls: { digital_content: "https://cdn.example.test/file" } }, false, 1],
    ["missing link", { payment: { status: "paid" } }, true, 0],
    ["insecure link", { payment: { status: "paid" }, urls: { digital_content: "http://cdn.example.test/file" } }, true, 0],
    ["paid HTTPS", { payment: { status: "paid" }, urls: { digital_content: "https://cdn.example.test/file" } }, true, 1]
  ])("evaluates digital delivery guard: %s", (_name, payload, paid, linkCount) => {
    const result = paidDigitalDelivery(payload);
    expect(result.paid).toBe(paid);
    expect(result.links).toHaveLength(linkCount);
  });

  it("normalizes digital credentials without exposing insecure links", () => {
    const result = paidDigitalDelivery({
      payment: { status: "paid" },
      urls: { digital_content: [
        { url: "https://cdn.example.test/license", name: "ترخيص", code: "CODE-1" },
        { url: "https://cdn.example.test/account", email: "buyer@example.test", password: "secret", duration_seconds: 3600 }
      ] }
    });
    expect(result.assets).toEqual([
      expect.objectContaining({ name: "ترخيص", code: "CODE-1", email: "" }),
      expect.objectContaining({ email: "buyer@example.test", password: "secret", durationSeconds: 3600 })
    ]);
    expect(result.links).toHaveLength(2);
  });

  it("persists CTA and secure digital-link controls and defaults first activation to WhatsApp", () => {
    expect(appSource).toContain('name="buttonEnabled"');
    expect(appSource).toContain('name="buttonLabel"');
    expect(appSource).toContain('name="secureLinkEnabled"');
    expect(serverSource).toContain("delivery_channel=COALESCE(delivery_channel,'whatsapp')");
    expect(serverSource).toContain('? "digital"');
    expect(styles).toContain(".salla-template-form-card>.section-head>svg");
  });

  it("keeps one save action and presents compact, readable editor controls", () => {
    expect(appSource).toContain("تفعيل زر الإجراء");
    expect(appSource).toContain("نص زر الإجراء");
    expect(appSource).not.toContain('form="salla-template-editor-form"');
    expect(appSource).toContain('<div class="salla-editor-actions"><button class="btn btn-primary" type="submit">');
    expect(styles).toContain(".salla-channel-panel>.variables-row{margin-top:18px");
    expect(styles).toContain(".salla-special-settings>.section-head>svg{width:24px!important;height:24px!important");
    expect(styles).toContain(".salla-action-settings .setting-line>span{min-width:0;display:grid;gap:5px}");
  });

  it("keeps the opposite channel content when the selected channel changes", () => {
    const switchedToEmail = resolveSallaChannelContent({
      channel: "email",
      input: { messageBody: "new email" },
      previous: {
        whatsappContent: "saved whatsapp",
        emailTextContent: "old email",
        emailHtmlContent: "saved html"
      },
      definition: { body: "default" }
    });
    expect(switchedToEmail).toEqual({
      whatsappContent: "saved whatsapp",
      emailTextContent: "new email",
      emailHtmlContent: "saved html"
    });
  });

  it("cancels delayed review requests when an order is cancelled or returned", () => {
    expect(serverSource).toContain("review_request_no_longer_valid");
    expect(serverSource).toContain("review_request_cancelled");
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
