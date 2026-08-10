import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../../src/app/app.js", import.meta.url), "utf8");
const stylesSource = readFileSync(new URL("../../src/styles/globals.css", import.meta.url), "utf8");

describe("clean channel navigation headers", () => {
  it("removes the duplicated channel selectors from overview and detail pages", () => {
    expect(appSource).not.toContain('class="ref-channel-pills"');
    expect(appSource).not.toContain("function channelDetailTabs(");
    expect(appSource).not.toContain('${channelDetailTabs("whatsapp")}');
    expect(appSource).not.toContain('${channelDetailTabs("email")}');
  });

  it("places a dedicated channels overview link in both detail headers", () => {
    expect(appSource.match(/class="channel-overview-link"/g)).toHaveLength(2);
    expect(appSource).toContain('class="channel-detail-heading channel-detail-heading-clean"');
    expect(appSource).toContain('${dashboardIcon("home")}<span>القنوات والربط</span>');
  });

  it("keeps the overview link visually left on desktop and responsive on mobile", () => {
    expect(stylesSource).toContain(".ref-detail-page .channel-detail-heading-clean{");
    expect(stylesSource).toContain("justify-content:space-between");
    expect(stylesSource).toContain(".channel-overview-link{");
    expect(stylesSource).toContain(".channel-overview-link{order:-1;justify-self:end");
  });
});
