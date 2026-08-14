import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sourceStyles = readFileSync(new URL("../../src/styles/globals.css", import.meta.url), "utf8");
const publicStyles = readFileSync(new URL("../../public/app/styles/globals.css", import.meta.url), "utf8");
const rootLayout = readFileSync(new URL("../../app/layout.jsx", import.meta.url), "utf8");
const staticIndex = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

const marker = "/* iPad public header: compact brand, balanced controls, and a single landscape rail. */";
const sourceRules = sourceStyles.slice(sourceStyles.indexOf(marker));

describe("iPad public header", () => {
  it("uses the reference proportions on wide iPad layouts", () => {
    expect(sourceRules).toContain('@media (min-width:1181px) and (max-width:1400px)');
    expect(sourceRules).toContain(':root[data-home-tablet-layout="true"] .public-site .public-nav');
    expect(sourceRules).toContain("min-height:116px");
    expect(sourceRules).toContain("grid-template-columns:126px minmax(0,1fr) 478px");
    expect(sourceRules).toContain("width:112px!important");
    expect(sourceRules).toContain("min-height:56px!important");
    expect(sourceRules).toContain("width:130px");
    expect(sourceRules).toContain("width:148px");
  });

  it("keeps a compact single-row rail at smaller landscape widths", () => {
    expect(sourceRules).toContain('@media (min-width:901px) and (max-width:1180px)');
    expect(sourceRules).toContain('grid-template-areas:"brand links actions"');
    expect(sourceRules).toContain("grid-template-rows:84px");
    expect(sourceRules).toContain("grid-template-columns:124px minmax(0,1fr) 334px");
    expect(sourceRules).toContain("min-height:46px!important");
  });

  it("shrinks the brand without disrupting the two-row portrait layout", () => {
    expect(sourceRules).toContain('@media (min-width:641px) and (max-width:900px)');
    expect(sourceRules).toContain("width:126px!important");
  });

  it("ships identical source and public rules with one cache key", () => {
    expect(publicStyles).toContain(sourceRules.trim());
    const nextStyleVersion = rootLayout.match(/globals\.css\?v=([^"']+)/)?.[1];
    const staticStyleVersion = staticIndex.match(/globals\.css\?v=([^"']+)/)?.[1];
    expect(nextStyleVersion).toBe("20260814-ai-gateway-v126");
    expect(staticStyleVersion).toBe(nextStyleVersion);
  });
});
