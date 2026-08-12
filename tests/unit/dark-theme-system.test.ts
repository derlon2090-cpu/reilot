import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("site-wide dark theme system", () => {
  it("loads the final dark stylesheet after the legacy stylesheet", async () => {
    const [layout, index] = await Promise.all([
      readFile(`${root}/app/layout.jsx`, "utf8"),
      readFile(`${root}/index.html`, "utf8")
    ]);

    for (const markup of [layout, index]) {
      expect(markup).toContain("/app/styles/dark-system.css?v=20260812-brand-v105");
      expect(markup.indexOf("globals.css")).toBeLessThan(markup.indexOf("dark-system.css"));
    }
  });

  it("covers public navigation, operational cards, footer and dashboard controls", async () => {
    const css = await readFile(`${root}/src/styles/dark-system.css`, "utf8");

    expect(css).toContain(".public-site .public-nav");
    expect(css).toContain(".ops-automation-track span svg");
    expect(css).toContain(".marketing-hero-metrics article>span svg");
    expect(css).toContain(".public-footer.marketing-footer .footer-social a svg");
    expect(css).toContain(".dashboard-shell .topbar");
    expect(css).toContain(".dashboard-shell .sidebar .side-link .line-icon");
    expect(css).toContain(".dashboard-main :is(.email-credit-package,.topup-option)");
    expect(css).toContain(".dashboard-main .suite-quick-center button>svg");
    expect(css).toContain(".dashboard-main .campaign-channel-choice.is-selected");
    expect(css).toContain(".dashboard-shell :is(.sidebar-brand,.sidebar-brand .brand,.sidebar .brand)");
    const authCss = await readFile(`${root}/src/styles/globals.css`, "utf8");
    expect(authCss).toContain("Canonical accounts.renvix.app dark theme");
    expect(authCss).toContain('.auth-suite-page[data-auth-theme="dark"] .auth-showcase-art');
    expect(css).not.toContain('background:radial-gradient(circle at 50% 48%,#f8fcfb');
  });

  it("uses the transparent logo assets in dark mode", async () => {
    const css = await readFile(`${root}/src/styles/dark-system.css`, "utf8");
    expect(css).toContain('/assets/renvix-logo-deep-teal.svg');
    expect(css).toContain('/assets/renvix-mark-deep-teal.svg');
  });
});
