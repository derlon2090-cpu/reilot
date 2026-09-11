import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const tokens = await readFile("src/styles/tokens.css", "utf8");
const identity = await readFile("src/styles/identity-system.css", "utf8");
const publicIdentity = await readFile("public/app/styles/identity-system.css", "utf8");
const layout = await readFile("app/layout.jsx", "utf8");
const staticIndex = await readFile("index.html", "utf8");
const appSource = await readFile("src/app/app.js", "utf8");

describe("Renvix identity system", () => {
  it("defines the complete brand and typography token scale", () => {
    for (let level = 50; level <= 900; level += level === 50 ? 50 : 100) {
      expect(tokens).toContain(`--brand-${level}:`);
    }
    expect(tokens).toContain("--brand-primary: var(--brand-700)");
    expect(tokens).toContain('--font-primary: var(--font-alexandria), "Alexandria"');
    expect(tokens).toContain("--text-4xl: 36px");
    expect(tokens).toContain("--radius-card: 15px");
    expect(tokens).toContain("--radius-modal: 20px");
  });

  it("loads Alexandria through next/font and as the static fallback", () => {
    expect(layout).toContain('import { Alexandria } from "next/font/google"');
    expect(layout).toContain('weight: ["400", "500", "600", "700"]');
    expect(layout).toContain('variable: "--font-alexandria"');
    expect(layout).toContain('className={alexandria.variable}');
    expect(staticIndex).toContain("family=Alexandria:wght@400;500;600;700");
    expect(staticIndex).not.toContain("IBM+Plex+Sans+Arabic");
  });

  it("keeps official logo variants as immutable image assets", () => {
    expect(appSource).toContain("const RENVIX_BRAND_ASSETS = Object.freeze");
    expect(appSource).toContain('primary: "/assets/renvix-logo-primary.png"');
    expect(appSource).toContain('compact: "/assets/renvix-logo-deep-teal.svg"');
    expect(appSource).toContain('icon: "/assets/renvix-mark-deep-teal.svg"');
    expect(appSource).toContain('compactDark: "/assets/renvix-logo-auth-dark.svg"');
    expect(appSource).toContain('surface === "footer" ? "compactDark"');
    expect(appSource).toContain('logo(false, "footer")');
    expect(identity).toContain("Wordmarks remain image assets");
    expect(identity).toContain("object-fit:contain");
    expect(identity).toContain('content:url("/assets/renvix-logo-deep-teal.svg")!important');
    expect(identity).toContain('content:url("/assets/renvix-logo-auth-dark.svg")!important');
    expect(identity).toContain(".brand-logo-image--footer");
    expect(identity).toContain("filter:brightness(0) invert(1)!important");
    expect(identity).toContain(".public-site>.public-nav .nav-inner>.brand");
    expect(identity).toContain(".dashboard-shell:not(.sidebar-collapsed) .sidebar .brand-logo-image--primary");
  });

  it("applies consistent weights, geometry, numeric alignment, and LTR fields", () => {
    expect(identity).toContain("font-weight:var(--weight-bold)!important");
    expect(identity).toContain("border-radius:var(--radius-input)!important");
    expect(identity).toContain("border-radius:var(--radius-card)");
    expect(identity).toContain("font-variant-numeric:tabular-nums");
    expect(identity).toContain('input[type="email"]');
    expect(identity).toContain('input[name*="api" i]');
    expect(identity).toContain("direction:ltr;text-align:left");
  });

  it("ships the identity layer last and keeps generated CSS synchronized", () => {
    expect(publicIdentity).toBe(identity);
    expect(layout.indexOf("identity-system.css")).toBeGreaterThan(layout.indexOf("approved-templates-reference.css"));
    expect(staticIndex.indexOf("identity-system.css")).toBeGreaterThan(staticIndex.indexOf("approved-templates-reference.css"));
  });
});
