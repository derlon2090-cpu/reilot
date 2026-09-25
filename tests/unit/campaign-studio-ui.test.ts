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

  it("supports up to ten cards with real editing, ordering, reusable image library, draft saving and live preview", () => {
    expect(appSource).toContain("الحد الأقصى 10 بطاقات");
    expect(appSource).toContain('data-action="campaign-studio-card-copy"');
    expect(appSource).toContain('data-action="campaign-studio-card-up"');
    expect(appSource).toContain('data-action="campaign-studio-card-down"');
    expect(appSource).toContain('data-action="campaign-studio-image-pick"');
    expect(appSource).toContain('data-action="campaign-image-library-upload"');
    expect(appSource).toContain('data-action="campaign-image-library-select"');
    expect(appSource).toContain('data-action="campaign-image-library-delete"');
    expect(appSource).toContain('data-action="campaign-image-library-show-all"');
    expect(appSource).toContain('index >= 6 ? " is-library-hidden"');
    expect(appSource).toContain('data-action="campaign-studio-image-remove"');
    expect(appSource).toContain("renvix.campaign-studio.${channel}.${kind}");
    expect(appSource).toContain("refreshCampaignStudioPreview");
    expect(assetsRoute).toContain("campaign-assets/${auth.session.tenantId}");
    expect(assetsRoute).toContain("MAX_IMAGE_BYTES = 5 * 1024 * 1024");
    expect(assetsRoute).toContain("export async function GET");
    expect(assetsRoute).toContain("export async function DELETE");
    expect(stylesSource).toContain(".campaign-image-library-grid");
    expect(appSource).toContain('openModal("مكتبة الصور"');
    expect(stylesSource).toContain("repeat(auto-fill,minmax(min(160px,100%),1fr))");
    expect(stylesSource).toContain("overflow:visible");
    expect(stylesSource).toContain(".campaign-image-library-card.is-library-hidden{display:none}");
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

  it("uses one canonical email template with color-only customization", () => {
    expect(appSource).toContain('name="emailDesign"');
    expect(appSource).toContain('value="showcase"');
    expect(appSource).toContain("القالب الرئيسي المعتمد");
    expect(appSource).toContain('name="themeColor"');
    expect(appSource).not.toContain("صورة المتجر أو غلاف الحملة");
    expect(appSource).not.toContain('data-action="campaign-studio-hero-image-pick"');
    expect(appSource).not.toContain('name="heroImageUrl"');
    expect(appSource).toContain('name="brandLogoUrl"');
    expect(appSource).toMatch(/\["name"[^\n]+"brandLogoUrl"[^\n]+\]\.forEach/);
    expect(appSource).toContain('data-action="campaign-studio-logo-image-pick"');
    expect(appSource).toContain("campaignStudioApplyFixedLogo");
    expect(appSource).not.toContain('class="campaign-email-brand"><img class="brand-logo-image brand-logo-image--primary" src="/assets/renvix-logo-primary.png"');
    expect(stylesSource).toContain(".campaign-email-primary-template");
    expect(stylesSource).toContain("--campaign-email-color");
  });

  it("restores the selected campaign mode after navigation or refresh", () => {
    expect(appSource).toContain('state.query.get("channel")');
    expect(appSource).toContain('state.query.get("kind")');
    expect(appSource).toContain('/dashboard/campaigns/new?channel=${encodeURIComponent(channel)}&kind=custom');
    expect(appSource).toContain('/dashboard/campaigns/new?channel=${encodeURIComponent(channel)}&kind=product');
  });

  it("keeps the customer logo and canonical card order in generated email code", () => {
    expect(appSource).toContain('aria-label="campaign-brand-logo"');
    expect(appSource).toContain('campaignStudioApplyFixedLogo(payload?.html || ""');
    expect(appSource).toContain('if (cards[0]) rows.push');
    expect(appSource).toContain('pair.length === 1');
    expect(stylesSource).toContain('.campaign-studio-email-preview.design-showcase .campaign-studio-preview-card:first-child');
  });

  it("provides a safe AI email-code workflow with focused code controls", () => {
    expect(appSource).not.toContain("مساعد صياغة الحملة");
    expect(appSource).not.toContain("/api/ai/campaign-copy/generate");
    expect(existsSync(new URL("../../app/api/ai/campaign-copy/generate/route.js", import.meta.url))).toBe(false);
    expect(appSource).toContain("توليد قالب برمجي (HTML)");
    expect(appSource).toContain("campaignStudioAIState");
    expect(appSource).toContain("/backend/ai/email-template/generate");
    expect(appSource).toContain('templateType: "campaign_email"');
    expect(appSource).toContain('data-action="campaign-studio-ai-regenerate"');
    expect(appSource).toContain('data-action="campaign-studio-ai-approve"');
    expect(appSource).toContain('data-action="campaign-studio-adopt-html"');
    expect(appSource).toContain('class="campaign-html-optional">اختياري</b>');
    expect(appSource).not.toContain('اعتماد التصميم <small>اختياري</small>');
    expect(appSource).toContain('data-action="campaign-studio-delete-html"');
    expect(appSource).toContain('data-action="campaign-studio-replace-html"');
    expect(appSource).toContain('data-action="campaign-studio-copy-html"');
    expect(appSource).not.toContain("توليد قالب أساسي");
    expect(appSource).toContain("syncAIQuota(payload)");
    expect(appSource).toContain('campaignStudioApplyFixedLogo(payload?.html || ""');
    expect(appSource).toContain("campaignStudioAIModalMarkup");
    expect(appSource).toContain('data-submit="campaign-ai-code-generate"');
    expect(appSource).toContain('name="selectedColor"');
    expect(appSource).toContain("refreshCampaignStudioPreview(form)");
    expect(appSource).not.toContain("data-campaign-ai-prompt");
    expect(appSource).toContain("data-campaign-html-status");
    expect(appSource).toContain('form.elements.htmlContent.value = inspection.html');
    expect(appSource).toContain('name="htmlContentApproved"');
    expect(appSource).toContain('data-action="campaign-studio-restore-main"');
    expect(appSource).toContain("استرجاع التصميم الرئيسي");
    expect(appSource).not.toContain('title="معاينة تصميم كود البريد"');
    expect(appSource).toContain("جميع البطاقات بالترتيب");
    expect(appSource).toContain("{{unsubscribe_url}}");
    expect(stylesSource).toContain(".campaign-generated-email-preview");
  });

  it("keeps generated code when sections close and makes campaign saving actionable", () => {
    expect(appSource).not.toContain('form.elements.htmlContent.value = ""');
    expect(appSource).toContain('if (!form.checkValidity())');
    expect(appSource).toContain("campaignSubmit.form.noValidate = true");
    expect(stylesSource).toContain(".campaign-studio[data-campaign-channel][data-campaign-kind] .campaign-studio-actions{position:static!important");
    expect(stylesSource).not.toContain(".campaign-studio[data-campaign-channel][data-campaign-kind] .campaign-studio-actions{position:fixed");
    expect(stylesSource).toContain(".campaign-studio[data-campaign-channel][data-campaign-kind] .campaign-studio-preview{position:sticky;top:76px");
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
    expect(appSource).toContain('const approvedHtml = data.channel === "email" && String(data.htmlContentApproved) === "true"');
    expect(appSource).not.toContain('campaignStudioForm.elements.htmlContent.value = ""');
    expect(stylesSource).toContain(".campaign-email-social.is-empty");
  });

  it("pins the campaigns return control at the upper left", () => {
    expect(stylesSource).toMatch(/\.campaign-studio-heading \.btn-ghost\{position:absolute;top:0;left:0/);
  });
});
