import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sourceStyles = readFileSync(new URL("../../src/styles/globals.css", import.meta.url), "utf8");
const publicStyles = readFileSync(new URL("../../public/app/styles/globals.css", import.meta.url), "utf8");
const rootLayout = readFileSync(new URL("../../app/layout.jsx", import.meta.url), "utf8");
const staticIndex = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

const tabletRuleStart = sourceStyles.indexOf("/* Tablet-only hero: the runtime touch flag");
const tabletRuleEnd = sourceStyles.indexOf("@media (min-width:641px) and (max-width:743px)", tabletRuleStart);
const tabletRules = sourceStyles.slice(tabletRuleStart, tabletRuleEnd);

describe("iPad home operations layout", () => {
  it("detects touch tablets before the stylesheet, including desktop-site mode", () => {
    for (const markup of [rootLayout, staticIndex]) {
      expect(markup).toContain("navigator.maxTouchPoints");
      expect(markup).toContain("data-home-tablet-layout");
      expect(markup).toContain("setAttribute('data-home-tablet-layout','true')");
      expect(markup).toContain("w>=641&&w<=1700");
      expect(markup).toContain("_tablet_layout");
    }
    expect(rootLayout).toContain("complete-backlog-v101");
    expect(staticIndex).toContain("complete-backlog-v101");
  });

  it("keeps only the six reference cards visible on iPad", () => {
    for (const card of [
      "ops-renewals",
      "ops-automation",
      "ops-reminders",
      "ops-integrations",
      "ops-revenue",
      "ops-success"
    ]) {
      expect(tabletRules).toContain(`.${card}`);
    }

    expect(tabletRules).toContain(".ops-live,");
    expect(tabletRules).toContain(".ops-metrics,");
    expect(tabletRules).toContain('[data-home-flow-line="live"]');
    expect(tabletRules).toContain('[data-home-flow-line="metrics"]');
    expect(tabletRules).toContain("display:none!important");
  });

  it("uses the same scaled reference geometry on wide iPad viewports", () => {
    const wideTouchRule = "@media (min-width:1181px) and (max-width:1700px)";
    const wideTouchStart = sourceStyles.indexOf(wideTouchRule, tabletRuleEnd);
    const wideTouchEnd = sourceStyles.indexOf("\n}", wideTouchStart) + 2;
    const wideTouchStyles = sourceStyles.slice(wideTouchStart, wideTouchEnd);

    expect(wideTouchStyles).toContain("width:640px;height:589px");
    expect(wideTouchStyles).toContain("transform:scale(.64)!important");
    expect(wideTouchStyles).toContain("grid-template-columns:minmax(0,1.3fr) minmax(390px,.7fr)");
    expect(wideTouchStyles).toContain(':root[data-home-tablet-layout="true"]');
  });

  it("lifts the iPad scene and separates the automation card from its wire", () => {
    expect(tabletRules).toContain("marketing-v3-hero-visual{position:relative;top:-8px");
    expect(tabletRules).toContain(".ops-automation{top:8px!important");
    expect(tabletRules).toContain(".ops-renewals{top:163px!important");
    expect(tabletRules).toContain(".ops-reminders{top:163px!important");
  });

  it("ships the tablet rules in the public stylesheet", () => {
    expect(publicStyles).toContain(tabletRules.trim());
  });
});
