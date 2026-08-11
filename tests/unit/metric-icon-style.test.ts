import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const sourceStyles = await readFile("src/styles/globals.css", "utf8");
const publicStyles = await readFile("public/app/styles/globals.css", "utf8");

describe("shared dashboard icon treatment", () => {
  it("keeps source and public dashboard styles synchronized", () => {
    const marker = "Shared Renvix operational icon system";

    expect(sourceStyles).toContain(marker);
    expect(publicStyles).toContain(marker);
  });

  it("uses the approved circular pale icon tile across every operational family", () => {
    expect(sourceStyles).toContain("--metric-icon-surface:#edf8f6");
    expect(sourceStyles).toContain("--metric-icon-ink:#087267");
    expect(sourceStyles).toContain("--metric-icon-border:#d8ebe7");
    expect(sourceStyles).toContain(".dashboard-main .suite-metric-icon,");
    expect(sourceStyles).toContain(".dashboard-main .template-summary-icon,");
    expect(sourceStyles).toContain(".dashboard-main .template-brand-icon,");
    expect(sourceStyles).toContain(".dashboard-main .billing-stat>span,");
    expect(sourceStyles).toContain(".dashboard-main .capi-summary-card>span,");
    expect(sourceStyles).toContain(".dashboard-main .salla-template-card-icon,");
    expect(sourceStyles).toContain(".dashboard-main .message-activation-icon{");
    expect(sourceStyles).toContain("border-radius:50%");
  });

  it("overrides legacy tone and alternating Salla colors with the Renvix palette", () => {
    expect(sourceStyles).toContain("--metric-value-ink:#087267");
    expect(sourceStyles).toContain("font-variant-numeric:tabular-nums");
    expect(sourceStyles).toContain(".dashboard-main .salla-template-card:nth-child(n) .salla-template-card-icon,");
    expect(sourceStyles).toContain(".dashboard-main .stat-card:is(.info,.success,.warning,.danger,.purple,.neutral) .stat-card-icon,");
    expect(sourceStyles).toContain(".dashboard-main .suite-metric:is(.info,.success,.warning,.danger,.purple,.teal) .suite-metric-icon,");
    expect(sourceStyles).toContain("stroke:currentColor!important");
  });
});
