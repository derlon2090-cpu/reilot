import fs from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = fs.readFileSync("src/app/app.js", "utf8");
const styles = fs.readFileSync("src/styles/globals.css", "utf8");

describe("user dashboard desktop sidebar interactions", () => {
  it("labels every navigation control for stable icon-specific motion", () => {
    expect(appSource).toContain('data-sidebar-icon="${mark}"');
    expect(appSource).toContain('data-sidebar-icon="support"');
  });

  it("uses fine-pointer desktop hover and press motion without changing box dimensions", () => {
    const desktopMotion = styles.slice(
      styles.indexOf("/* Desktop-only, no-layout-shift interaction for user dashboard navigation. */"),
      styles.indexOf("/* Campaign Studio reference layout", styles.indexOf("/* Desktop-only, no-layout-shift interaction for user dashboard navigation. */"))
    );
    expect(desktopMotion).toContain("@media (min-width: 981px) and (hover: hover) and (pointer: fine)");
    expect(desktopMotion).toContain("transform: translateY(-1px)");
    expect(desktopMotion).toContain("scale(.985)");
    expect(desktopMotion).toContain("transition-duration: 90ms");
    expect(desktopMotion).toContain("height: calc(100% - 14px)");
    expect(desktopMotion).toContain("inset-inline-start: 0");
    expect(desktopMotion).toContain('data-sidebar-icon="settings"');
    expect(desktopMotion).toContain('data-sidebar-icon="reports"');
    expect(desktopMotion).toContain('data-sidebar-icon="campaigns"');
    expect(desktopMotion).toContain('data-sidebar-icon="customers"');
    const hoverRuleStart = desktopMotion.indexOf(":not(.active):is(:hover, :focus-visible) {");
    const hoverRule = desktopMotion.slice(hoverRuleStart, desktopMotion.indexOf("}", hoverRuleStart));
    expect(hoverRule).not.toMatch(/(?:width|height|padding|margin)\s*:/);
  });

  it("keeps active navigation deep teal and respects reduced motion", () => {
    const activeRuleStart = styles.indexOf(".dashboard-shell .sidebar :is(.side-link, .sidebar-support-link).active {");
    const activeRule = styles.slice(activeRuleStart, styles.indexOf("}", activeRuleStart));
    expect(activeRuleStart).toBeGreaterThanOrEqual(0);
    expect(activeRule).toContain("color: #FFFFFF !important;");
    expect(activeRule).toContain("background: #0B3F3B !important;");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
