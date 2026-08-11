import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sourceStyles = readFileSync(new URL("../../src/styles/globals.css", import.meta.url), "utf8");
const publicStyles = readFileSync(new URL("../../public/app/styles/globals.css", import.meta.url), "utf8");

const tabletRuleStart = sourceStyles.indexOf("/* iPad-only hero: six-card network");
const tabletRuleEnd = sourceStyles.indexOf("@media (min-width:641px) and (max-width:743px)", tabletRuleStart);
const tabletRules = sourceStyles.slice(tabletRuleStart, tabletRuleEnd);

describe("iPad home operations layout", () => {
  it("selects wide touch tablets without changing same-width laptops", () => {
    expect(tabletRules).toContain(
      "(min-width:1181px) and (max-width:1366px) and (hover:none) and (pointer:coarse)"
    );
    expect(tabletRules).not.toContain(
      "(min-width:1181px) and (max-width:1366px){"
    );
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
    const wideTouchRule =
      "@media (min-width:1181px) and (max-width:1366px) and (hover:none) and (pointer:coarse)";
    const wideTouchStart = sourceStyles.indexOf(wideTouchRule, tabletRuleEnd);
    const wideTouchEnd = sourceStyles.indexOf("\n}", wideTouchStart) + 2;
    const wideTouchStyles = sourceStyles.slice(wideTouchStart, wideTouchEnd);

    expect(wideTouchStyles).toContain("width:640px;height:589px");
    expect(wideTouchStyles).toContain("transform:scale(.64)!important");
    expect(wideTouchStyles).toContain("grid-template-columns:minmax(0,1.3fr) minmax(390px,.7fr)");
  });

  it("ships the tablet rules in the public stylesheet", () => {
    expect(publicStyles).toContain(tabletRules.trim());
  });
});
