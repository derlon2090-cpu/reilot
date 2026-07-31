import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { baseEmail } from "../../src/lib/email/templates/base-email.js";

const editorSource = readFileSync(resolve("src/components/admin/AdminTemplateEditor.jsx"), "utf8");
const editorStyles = readFileSync(resolve("src/components/admin/AdminPortal.module.css"), "utf8");
const updateRouteSource = readFileSync(resolve("app/api/admin/templates/[templateKey]/route.js"), "utf8");
const previewRouteSource = readFileSync(resolve("app/api/admin/templates/[templateKey]/preview/route.js"), "utf8");
const testRouteSource = readFileSync(resolve("app/api/admin/templates/[templateKey]/test/route.js"), "utf8");
const deliverySource = readFileSync(resolve("src/server/admin-template-events.js"), "utf8");
const resendSource = readFileSync(resolve("src/server/email/resend.service.js"), "utf8");

describe("admin template channel selection", () => {
  it("offers both real admin delivery channels inside the shared template editor", () => {
    expect(editorSource).toContain('selectChannel("email")');
    expect(editorSource).toContain('selectChannel("evolution_whatsapp")');
    expect(editorSource).toContain('role="radiogroup"');
    expect(editorStyles).toContain(".adminChannelChoiceActive");
  });

  it("changes the preview and test recipient controls with the selected channel", () => {
    expect(editorSource).toContain("<TemplatePreview template={{ ...template, ...form }} rendered={rendered} />");
    expect(editorSource).toContain('channel: form.channel');
    expect(editorSource).toContain('form.channel === "email" ? "email" : "tel"');
    expect(previewRouteSource).toContain('channel: z.enum(["email", "evolution_whatsapp"]).optional()');
  });

  it("persists the selected channel and uses it for test delivery", () => {
    expect(updateRouteSource).toContain('channel: z.enum(["email", "evolution_whatsapp"])');
    expect(updateRouteSource).toContain("channel=$4");
    expect(testRouteSource).toContain("channel,");
    expect(deliverySource).toContain("const deliveryChannel = channel || template.channel;");
    expect(deliverySource).toContain("const provider = deliveryChannel === \"email\" ? \"resend\" : \"evolution\";");
  });

  it("resolves actual recipients according to the saved channel", () => {
    expect(deliverySource).toContain("resolveEvent(event, template.channel)");
    expect(deliverySource).toContain("sc.email_eligible AS \"emailEligible\"");
    expect(deliverySource).toContain("s.support_phone AS \"supportPhone\"");
    expect(deliverySource).toContain("channelRecipient(channel");
  });

  it("keeps the Renvix admin logo fixed in preview and actual email HTML", () => {
    const logoUrl = "https://renvix.app/assets/renewpilot-logo-horizontal.webp";
    const html = baseEmail({ title: "Admin", children: "Message", brandImageUrl: logoUrl });
    expect(editorSource).toContain('/assets/renewpilot-logo-horizontal.webp');
    expect(deliverySource).toContain(logoUrl);
    expect(deliverySource).toContain("brandImageUrl: adminEmailLogoUrl()");
    expect(resendSource).toContain('brandImageUrl = ""');
    expect(html).toContain(`src="${logoUrl}"`);
  });
});
