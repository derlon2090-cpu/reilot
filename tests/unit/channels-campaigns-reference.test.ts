import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../../src/app/app.js", import.meta.url), "utf8");
const stylesSource = readFileSync(new URL("../../src/styles/globals.css", import.meta.url), "utf8");
const draftTestRoute = readFileSync(new URL("../../app/api/campaigns/test-draft/route.js", import.meta.url), "utf8");
const emailSyncRoute = readFileSync(new URL("../../app/api/channels/email/sync/route.js", import.meta.url), "utf8");

describe("reference channel and campaign experiences", () => {
  it("opens email management in the full page instead of the legacy drawer", () => {
    expect(appSource).toContain('data-action="email-manage-scroll"');
    expect(appSource).toContain('if (action === "email-manage-scroll")');
    expect(appSource).not.toContain('if (action === "email-domain-details")');
    expect(appSource).not.toContain('if (action === "email-sender-details")');
    expect(appSource).toContain('class="suite-page channel-detail-page email-channel-page ref-detail-page"');
  });

  it("keeps both campaign channels in the creation cards and uses the full builder", () => {
    expect(appSource).toContain('class="suite-page campaign-builder-page ref-campaign-builder"');
    expect(appSource).toContain('campaignChannelChoice(kind, "whatsapp"');
    expect(appSource).toContain('campaignChannelChoice(kind, "email"');
    expect(appSource).toContain('data-submit="campaign-create" class="ref-campaign-form"');
    expect(appSource).not.toContain('${campaignCreateModalMarkup()}</main><aside');
    expect(stylesSource).toContain('.ref-builder-actions{position:static!important');
  });

  it("wires test sends and email synchronization to authenticated provider routes", () => {
    expect(appSource).toContain('/api/campaigns/test-draft');
    expect(appSource).toContain('/api/channels/email/sync');
    expect(draftTestRoute).toContain('sendEmail({');
    expect(draftTestRoute).toContain('sendMetaTextMessage({');
    expect(draftTestRoute).toContain('sameOriginRequest(request)');
    expect(emailSyncRoute).toContain('resendProviderHealth({ force: true })');
    expect(emailSyncRoute).toContain('sameOriginRequest(request)');
  });

  it("keeps the reference layout responsive at desktop, tablet, and mobile widths", () => {
    expect(stylesSource).toContain('@media (min-width:1101px)');
    expect(stylesSource).toContain('@media (max-width:900px)');
    expect(stylesSource).toContain('@media (max-width:640px)');
    expect(stylesSource).toContain('grid-template-columns:repeat(6,minmax(0,1fr))!important');
  });
});
