import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../../src/app/app.js", import.meta.url), "utf8");
const stylesSource = readFileSync(new URL("../../src/styles/globals.css", import.meta.url), "utf8");

describe("campaign studio reference layout", () => {
  it("renders the four channel and campaign-kind variants in their dedicated studio", () => {
    expect(appSource).toContain('data-campaign-channel="${channel}"');
    expect(appSource).toContain('data-campaign-kind="${kind}"');
    expect(stylesSource).toContain(".campaign-studio.is-email.is-product .campaign-studio-preview");
    expect(stylesSource).toContain(".campaign-studio.is-email.is-custom .campaign-studio-preview");
    expect(stylesSource).toContain(".campaign-studio.is-whatsapp.is-product .campaign-studio-preview");
    expect(stylesSource).toContain(".campaign-studio.is-whatsapp.is-custom .campaign-studio-preview");
  });

  it("uses an extended phone preview for WhatsApp and a full mail window for email", () => {
    expect(appSource).toContain("function campaignStudioWhatsappPreview(cards)");
    expect(appSource).toContain("function campaignStudioEmailPreview(cards, emailDesign, emailSender, kind)");
    expect(appSource).toContain('class="campaign-email-windowbar"');
    expect(appSource).toContain('class="campaign-email-message-meta"');
    expect(appSource).toContain('src="/assets/renvix-logo-exact.png"');
    expect(appSource).toContain('src="/assets/renvix-mark-deep-teal.svg"');
    expect(stylesSource).toMatch(/\.campaign-studio\.is-whatsapp \.campaign-studio-phone\{[^}]*min-height:720px/);
    expect(stylesSource).toMatch(/\.campaign-studio\.is-email \.campaign-studio-email-preview\{[^}]*min-height:720px/);
  });

  it("keeps the preview driven by the actual form cards, sender and social links", () => {
    expect(appSource).toContain("campaignStudioPreviewCards(cards, \"whatsapp\")");
    expect(appSource).toContain("campaignStudioPreviewCards(cards, \"email\")");
    expect(appSource).toContain("safeStoreLogoUrl(firstCard.imageUrl)");
    expect(appSource).toContain("form.elements.fromName?.value?.trim()");
    expect(appSource).toContain("campaignStudioSocialIconLinks(form)");
    expect(appSource).toContain("data-campaign-email-hero-media");
  });

  it("preserves the visual template when switching desktop, tablet and mobile preview modes", () => {
    expect(appSource).toContain('preview.className = `campaign-studio-email-preview ${state.campaignBuilderPreviewMode} design-${design}`');
    expect(stylesSource).toContain("@media (max-width:1280px) and (min-width:921px)");
    expect(stylesSource).toContain("@media (max-width:920px)");
    expect(stylesSource).toContain("@media (max-width:700px)");
    expect(stylesSource).toContain("@media (max-width:420px)");
  });
});
