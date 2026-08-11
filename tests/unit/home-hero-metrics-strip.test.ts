import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync("src/app/app.js", "utf8");
const stylesSource = readFileSync("src/styles/globals.css", "utf8");

describe("home hero metrics strip", () => {
  it("keeps all four metrics in one static row on laptop and iPad", () => {
    expect(stylesSource).toContain(".marketing-hero-metrics{grid-area:metrics;direction:rtl;display:grid;grid-template-columns:repeat(4,minmax(0,1fr))");
    expect(stylesSource).toMatch(/@media \(max-width:900px\)[^{]*\{[^}]*[\s\S]*?\.marketing-hero-metrics\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
    expect(stylesSource).toContain("@media (min-width:641px) and (max-width:900px)");
    expect(stylesSource).toContain("animation:none!important;transform:none!important;transition:none!important");
  });

  it("uses the reference-aligned Meta mark and supporting status icons", () => {
    expect(appSource).toContain('localizedCopy("تكامل رسمي مع Meta", "Official Meta integration")');
    expect(appSource).toContain('"infinity", "success"');
    expect(appSource).toContain("data-static-hero-metric");
    expect(appSource).toContain("${note}${dashboardIcon(noteIcon)}");
  });
});
