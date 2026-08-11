import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const appSource = await readFile("src/app/app.js", "utf8");
const stylesSource = await readFile("src/styles/globals.css", "utf8");

describe("dashboard line tabs", () => {
  it("uses the shared icon-and-underline treatment in billing and subscriptions", () => {
    expect(appSource).toContain('class="subscription-section-tabs dashboard-line-tabs"');
    expect(appSource).toContain('class="billing-tabs dashboard-line-tabs"');
    expect(appSource).toContain('class="dashboard-line-tab-icon"');
  });

  it("keeps the active treatment flat and driven by the Renvix underline", () => {
    expect(stylesSource).toContain(".dashboard-line-tabs button.active { color:#0B3F3B; background:transparent; box-shadow:none; }");
    expect(stylesSource).toContain(".dashboard-line-tabs button.active::after { transform:scaleX(1); }");
    expect(stylesSource).toContain("border-bottom:1px solid #DDE9E7");
  });

  it("supports horizontal navigation on small screens", () => {
    expect(stylesSource).toContain("overflow-x:auto");
    expect(stylesSource).toContain("scroll-snap-type:x proximity");
  });
});
