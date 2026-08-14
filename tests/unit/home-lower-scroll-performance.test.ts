import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("homepage lower-section scroll performance", () => {
  const appSource = readFileSync("src/app/app.js", "utf8");
  const cssSource = readFileSync("src/styles/globals.css", "utf8");
  const rootLayout = readFileSync("app/layout.jsx", "utf8");
  const staticIndex = readFileSync("index.html", "utf8");

  it("runs only the most visible motion scene and pauses its SVG timeline offscreen", () => {
    expect(appSource).toContain('const motionScenes = [...root.querySelectorAll("[data-motion-scene]")]');
    expect(appSource).toContain("const motionVisibility = new Map");
    expect(appSource).toContain("scene === activeScene && activeRatio > 0");
    expect(appSource).toContain("svg.pauseAnimations?.()");
    expect(appSource).toContain("svg.unpauseAnimations?.()");
    expect(appSource).toContain('document.addEventListener("visibilitychange", handleMotionVisibility)');
  });

  it("pauses offscreen CSS motion and removes paint-heavy animated filters", () => {
    expect(cssSource).toContain("[data-motion-scene]:not(.is-in-view) *");
    expect(cssSource).toContain("animation-play-state:paused!important");
    expect(cssSource).toContain("contain:layout paint style");
    expect(cssSource).toContain("@keyframes homeJourneyNodePass{0%,9%,100%{transform:translateZ(0) scale(1)}");
    expect(cssSource).not.toContain("filter:url(#renewal-journey-glow)");
    expect(cssSource).not.toContain("filter:drop-shadow(0 0 2px rgba(8,127,116,.28))");
    expect(cssSource).not.toContain("filter:drop-shadow(0 0 2px rgba(8,143,130,.3))");
  });

  it("keeps trusted-brand cards visible and their marquee continuous across neighboring scenes", () => {
    expect(appSource).toContain('<section class="marketing-commerce-ecosystem" data-social-proof data-continuous-marquee data-home-immediate>');
    expect(appSource).not.toMatch(/class="marketing-commerce-ecosystem"[^>]*data-motion-scene/);
    expect(appSource).toContain('data-motion-variant="logoCardHover"');
    expect(appSource).not.toContain('data-motion-variant="logoCardReveal logoCardHover"');
    expect(appSource).toContain('loading="eager" decoding="async"');
    expect(cssSource).toMatch(/\.trusted-brand-card\{[\s\S]*?opacity:1;[\s\S]*?transform:none;/);
    expect(cssSource).toMatch(/animation:trustedBrandsMarquee 32s linear infinite;\s+animation-play-state:running/);
    expect(cssSource).not.toContain(".trusted-brands-viewport:hover .trusted-brands-track{animation-play-state:paused}");
  });

  it("forces browsers to fetch the optimized motion bundle and stylesheet", () => {
    const versions = (source: string) => ({
      styles: source.match(/globals\.css\?v=([^"']+)/)?.[1],
      app: source.match(/app\.js\?v=([^"']+)/)?.[1]
    });
    const next = versions(rootLayout);
    expect(next.styles).toBeTruthy();
    expect(next.app).toBe(next.styles);
    expect(versions(staticIndex)).toEqual(next);
  });
});
