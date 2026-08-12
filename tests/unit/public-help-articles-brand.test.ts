import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const layoutSource = fs.readFileSync(path.join(root, "app/layout.jsx"), "utf8");
const staticIndexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const sitemapSource = fs.readFileSync(path.join(root, "app/sitemap.js"), "utf8");
const faviconSource = fs.readFileSync(path.join(root, "public/assets/renvix-favicon.svg"), "utf8");

describe("public help articles and Renvix browser identity", () => {
  it("uses the Renvix mark for browser icons instead of the default globe", () => {
    expect(layoutSource).toContain('url: "/assets/renvix-favicon.svg?v=20260812-brand-v105"');
    expect(layoutSource).toContain('shortcut: "/assets/renvix-favicon.svg?v=20260812-brand-v105"');
    expect(layoutSource).toContain('apple: "/assets/renvix-favicon.svg?v=20260812-brand-v105"');
    expect(staticIndexSource).toContain('/assets/renvix-favicon.svg?v=20260812-brand-v105');
    expect(faviconSource).toContain('stroke="#0B3F3B"');
    expect(faviconSource).not.toContain("<rect");
    expect(faviconSource).not.toContain("#eaf8f5");
  });

  it("publishes every help article in the sitemap", () => {
    for (const slug of [
      "quick-start-guide",
      "subscription-management-guide",
      "integrations-settings-guide",
      "billing-payments-guide",
      "reports-analytics-guide"
    ]) {
      expect(sitemapSource).toContain(`"${slug}"`);
    }
  });

  it("ships all five generated blog covers inside the project", () => {
    for (const file of [
      "help-quick-start.png",
      "help-subscriptions.png",
      "help-integrations.png",
      "help-billing.png",
      "help-reports.png"
    ]) {
      const assetPath = path.join(root, "public/assets/blog", file);
      expect(fs.existsSync(assetPath)).toBe(true);
      expect(fs.statSync(assetPath).size).toBeGreaterThan(100_000);
    }
  });

  it("uses one cache version for the updated public script and styles", () => {
    expect(layoutSource).toContain("20260812-brand-v105");
    expect(staticIndexSource).toContain("20260812-brand-v105");
  });
});
