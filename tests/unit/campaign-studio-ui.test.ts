import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../../src/app/app.js", import.meta.url), "utf8");
const stylesSource = readFileSync(new URL("../../src/styles/globals.css", import.meta.url), "utf8");
const campaignsRoute = readFileSync(new URL("../../app/api/campaigns/route.js", import.meta.url), "utf8");
const assetsRoute = readFileSync(new URL("../../app/api/campaigns/assets/route.js", import.meta.url), "utf8");
const schemaSource = readFileSync(new URL("../../src/server/campaign-config.js", import.meta.url), "utf8");

describe("campaign studio", () => {
  it("renders four dedicated states without a channel or campaign-kind switch inside", () => {
    const studio = appSource.slice(appSource.indexOf("function campaignStudioPage()"), appSource.indexOf("function legacyCampaignsPage()"));
    expect(studio).toContain('is-${channel} is-${kind}');
    expect(studio).toContain('kind === "product"');
    expect(studio).toContain('channel === "whatsapp"');
    expect(studio).toContain("القناة والنوع محددان مسبقًا");
    expect(studio).not.toContain('data-action="campaign-builder-channel"');
    expect(studio).not.toContain('data-action="campaign-builder-kind"');
  });

  it("uses actual catalog products, approved Meta templates, stored email templates, and eligible audiences", () => {
    expect(campaignsRoute).toContain("FROM salla_products WHERE tenant_id=$1 AND is_available=true");
    expect(campaignsRoute).toContain("meta_status,''))='APPROVED'");
    expect(campaignsRoute).toContain("FROM notification_templates");
    expect(campaignsRoute).toContain('AS "whatsappContactsCount"');
    expect(campaignsRoute).toContain('AS "emailContactsCount"');
    expect(campaignsRoute).toContain("cp.consent_status <> 'revoked'");
  });

  it("supports up to ten cards with real editing, ordering, image upload, draft saving and live preview", () => {
    expect(appSource).toContain("الحد الأقصى 10 بطاقات");
    expect(appSource).toContain('data-action="campaign-studio-card-copy"');
    expect(appSource).toContain('data-action="campaign-studio-card-up"');
    expect(appSource).toContain('data-action="campaign-studio-card-down"');
    expect(appSource).toContain('data-action="campaign-studio-image-file"');
    expect(appSource).toContain("renvix.campaign-studio.${channel}.${kind}");
    expect(appSource).toContain("refreshCampaignStudioPreview");
    expect(assetsRoute).toContain("campaign-assets/${auth.session.tenantId}");
    expect(assetsRoute).toContain("MAX_IMAGE_BYTES = 5 * 1024 * 1024");
  });

  it("validates cards and store ownership on the server", () => {
    expect(schemaSource).toContain("campaignCardSchema");
    expect(schemaSource).toContain("cards.length < 1 || cards.length > 10");
    expect(campaignsRoute).toContain("id=ANY($2::uuid[])");
    expect(campaignsRoute).toContain("invalid_campaign_product");
  });

  it("covers desktop, tablet and mobile layouts", () => {
    expect(stylesSource).toContain("@media (max-width:1180px)");
    expect(stylesSource).toContain("@media (max-width:920px)");
    expect(stylesSource).toContain("@media (max-width:700px)");
    expect(stylesSource).toContain("@media (max-width:460px)");
    expect(stylesSource).toContain(".campaign-studio-email-preview.mobile");
  });

  it("treats email templates as visual layouts instead of campaign copy", () => {
    expect(appSource).toContain('name="emailDesign"');
    expect(appSource).toContain('id:"luxury"');
    expect(appSource).toContain('id:"showcase"');
    expect(appSource).toContain('id:"editorial"');
    expect(appSource).toContain('id:"seasonal"');
    expect(appSource).toContain('id:"minimal"');
    expect(appSource).toContain('id:"spotlight"');
    expect(appSource).toContain("الاختيار يغيّر التصميم فقط ولا يستبدل نصوص حملتك");
    expect(stylesSource).toContain(".campaign-template-thumb.design-luxury");
    expect(stylesSource).toContain(".campaign-studio-email-preview.design-spotlight");
  });

  it("renders valid social links as icons inside the email preview and generated HTML", () => {
    expect(appSource).toContain("function campaignStudioSocialIconLinks");
    expect(appSource).toContain("data-campaign-social-preview");
    expect(appSource).toContain("campaignStudioValidHttpUrl");
    expect(appSource).toContain("socialLinks ?");
    expect(appSource).toContain('data.htmlContent || campaignStudioGeneratedHtml(form)');
    expect(stylesSource).toContain(".campaign-email-social.is-empty");
  });

  it("pins the campaigns return control at the upper left", () => {
    expect(stylesSource).toMatch(/\.campaign-studio-heading \.btn-ghost\{position:absolute;top:0;left:0/);
  });
});
