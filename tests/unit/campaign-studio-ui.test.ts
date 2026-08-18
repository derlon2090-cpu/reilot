import { existsSync, readFileSync } from "node:fs";
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

  it("provides an AI email-code workflow without removing the local HTML generator", () => {
    expect(appSource).not.toContain("مساعد صياغة الحملة");
    expect(appSource).not.toContain("/api/ai/campaign-copy/generate");
    expect(existsSync(new URL("../../app/api/ai/campaign-copy/generate/route.js", import.meta.url))).toBe(false);
    expect(appSource).toContain("توليد قالب برمجي (HTML)");
    expect(appSource).toContain("campaignStudioAIState");
    expect(appSource).toContain("/api/ai/email-template/generate");
    expect(appSource).toContain('templateType: "campaign_email"');
    expect(appSource).toContain('data-action="campaign-studio-ai-replace"');
    expect(appSource).toContain('data-action="campaign-studio-ai-approve"');
    expect(appSource).toContain('data-action="campaign-studio-generate-html"');
    expect(appSource).toContain("campaignStudioGeneratedHtml(form)");
    expect(appSource).toContain("data-campaign-html-status");
  });

  it("keeps generated code when sections close and makes campaign saving actionable", () => {
    expect(appSource).not.toContain('form.elements.htmlContent.value = ""');
    expect(appSource).toContain('if (!form.checkValidity())');
    expect(appSource).toContain("campaignSubmit.form.noValidate = true");
    expect(stylesSource).toContain("bottom:max(8px,env(safe-area-inset-bottom))");
    expect(stylesSource).toContain("pointer-events:auto");
  });

  it("keeps social links collapsed while preserving entered icons in the preview", () => {
    expect(appSource).toContain("function campaignStudioSocialIconLinks");
    expect(appSource).toContain("data-campaign-social-preview");
    expect(appSource).toContain('campaignStudioDraftValue("socialLinksEnabled", "false") === "true"');
    expect(appSource).toContain('data-campaign-social-section ${socialLinksEnabled ? "open" : ""}');
    expect(appSource).not.toContain('Boolean(values.querySelector?.("[data-campaign-social-section]")?.open)');
    expect(appSource).toContain('const socialLinks = campaignStudioSocialPlatforms().map');
    expect(appSource).toContain('if (!campaignStudioValidHttpUrl(value))');
    expect(appSource).toContain('const raw = String(getValue(name) || "").trim()');
    expect(appSource).toContain('campaign-email-social-icon is-invalid');
    expect(appSource).toContain('document.addEventListener("toggle"');
    expect(appSource).toContain('document.addEventListener("click"');
    expect(appSource).toContain('const socialLinksEnabled = Object.keys(socialLinks).length > 0');
    expect(appSource).toContain("campaignStudioValidHttpUrl");
    expect(appSource).toContain("socialLinks ?");
    expect(appSource).toContain('data.htmlContent || campaignStudioGeneratedHtml(form)');
    expect(appSource).not.toContain('campaignStudioForm.elements.htmlContent.value = ""');
    expect(stylesSource).toContain(".campaign-email-social.is-empty");
  });

  it("pins the campaigns return control at the upper left", () => {
    expect(stylesSource).toMatch(/\.campaign-studio-heading \.btn-ghost\{position:absolute;top:0;left:0/);
  });
});
