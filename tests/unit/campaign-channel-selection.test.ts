import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../../src/app/app.js", import.meta.url), "utf8");
const stylesSource = readFileSync(new URL("../../src/styles/globals.css", import.meta.url), "utf8");
const campaignsRoute = readFileSync(new URL("../../app/api/campaigns/route.js", import.meta.url), "utf8");

describe("exclusive campaign channel selection", () => {
  it("stores one nullable channel independently for each creation card", () => {
    expect(appSource).toContain("state.productCampaignChannel = null");
    expect(appSource).toContain("state.customCampaignChannel = null");
    expect(appSource).toContain('const key = kind === "product" ? "productCampaignChannel" : "customCampaignChannel"');
    expect(appSource).toContain("state[key] = state[key] === channel ? null : channel");
    expect(appSource).toContain("state[key] && state[key] !== channel");
  });

  it("keeps both choices visible and disables continuation until a real channel is selected", () => {
    expect(appSource).toContain('class="campaign-channel-choice');
    expect(appSource).toContain('campaignChannelChoice(kind, "whatsapp"');
    expect(appSource).toContain('campaignChannelChoice(kind, "email"');
    expect(appSource).toContain("يمكن اختيار قناة واحدة فقط لكل حملة");
    expect(appSource).toContain('${selected ? "" : "disabled"}');
    expect(appSource).toContain("أزل تحديد ${otherLabel} أولًا لتتمكن من اختيار ${currentLabel}");
  });

  it("opens a channel-specific builder without the removable top channel tabs", () => {
    const builderSource = appSource.slice(
      appSource.indexOf("function campaignStudioPage()"),
      appSource.indexOf("function legacyCampaignsPage()")
    );
    expect(builderSource).toContain('class="suite-page campaign-studio is-${channel} is-${kind}"');
    expect(builderSource).toContain('data-campaign-studio');
    expect(builderSource).toContain('data-action="campaign-builder-exit"');
    expect(builderSource).not.toContain("campaign-builder-tabs");
    expect(builderSource).not.toContain("campaign-builder-channel");
  });

  it("uses connected providers and synchronized products instead of mock options", () => {
    expect(campaignsRoute).toContain("FROM salla_products");
    expect(campaignsRoute).toContain("is_available=true");
    expect(campaignsRoute).toContain("connected: Boolean(process.env.RESEND_API_KEY && emailSender)");
    expect(appSource).toContain('data-submit="campaign-product-select"');
    expect(appSource).toContain("cards: campaignCards");
  });

  it("matches the Renvix identity and responsive states", () => {
    expect(stylesSource).toContain(".campaign-channel-choice.is-selected{border-color:#0b3f3b");
    expect(stylesSource).toContain(".campaign-channel-choice.is-disabled{opacity:.5;cursor:not-allowed}");
    expect(stylesSource).toContain(".campaign-channel-options{grid-template-columns:1fr}");
    expect(stylesSource).toContain("background-image:none");
  });
});
