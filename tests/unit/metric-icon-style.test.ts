import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const sourceStyles = await readFile("src/styles/globals.css", "utf8");
const publicStyles = await readFile("public/app/styles/globals.css", "utf8");

describe("shared metric icon treatment", () => {
  it("keeps source and public dashboard styles synchronized", () => {
    const marker = "Shared Renvix metric treatment";

    expect(sourceStyles).toContain(marker);
    expect(publicStyles).toContain(marker);
  });

  it("uses the approved circular pale icon tile across remaining metric families", () => {
    expect(sourceStyles).toContain("--metric-icon-surface:#edf8f6");
    expect(sourceStyles).toContain("--metric-icon-ink:#087267");
    expect(sourceStyles).toContain(".dashboard-main .template-summary-icon,");
    expect(sourceStyles).toContain(".dashboard-main .billing-stat>span,");
    expect(sourceStyles).toContain(".dashboard-main .capi-summary-card>span{");
    expect(sourceStyles).toContain(".dashboard-main .salla-template-card-icon,");
    expect(sourceStyles).toContain("border-radius:50%");
  });

  it("uses tabular teal values while retaining warning and danger semantics", () => {
    expect(sourceStyles).toContain("--metric-value-ink:#087267");
    expect(sourceStyles).toContain("font-variant-numeric:tabular-nums");
    expect(sourceStyles).toContain(".dashboard-main .template-summary-icon.warning,");
    expect(sourceStyles).toContain(".dashboard-main .stat-card.danger .stat-card-icon{");
  });
});
