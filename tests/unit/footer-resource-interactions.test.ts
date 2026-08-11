import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync("src/app/app.js", "utf8");
const stylesSource = readFileSync("src/styles/globals.css", "utf8");

describe("footer resource pages", () => {
  it("uses the clean public-site background without decorative hero rings", () => {
    expect(stylesSource).toMatch(/\.footer-showcase-page\s*\{[^}]*background:#fff;/);
    expect(stylesSource).toContain(".fp-hero::before,.fp-hero::after{display:none;content:none}");
  });

  it("wires user-guide and FAQ search to real filtering handlers", () => {
    expect(appSource).toContain('data-action="footer-guide-search"');
    expect(appSource).toContain('data-action="footer-guide-suggestion"');
    expect(appSource).toContain('data-action="footer-faq-search"');
    expect(appSource).toContain('data-action="footer-faq-topic"');
    expect(appSource).toContain("function refreshFooterGuideResults(input)");
    expect(appSource).toContain("function refreshFooterFaqResults(root");
  });

  it("makes FAQ and template category choices interactive and accessible", () => {
    expect(appSource).toContain('data-action="footer-faq-filter"');
    expect(appSource).toContain('data-action="footer-template-filter"');
    expect(appSource).toContain('data-action="footer-template-preview"');
    expect(appSource).toContain('aria-pressed="${index===0?"true":"false"}"');
    expect(appSource).toContain('aria-pressed="${x===0?"true":"false"}"');
    expect(appSource).toContain("function previewFooterTemplate(target)");
    expect(stylesSource).toContain(".fp-guide [hidden],.fp-faq [hidden],.fp-templates [hidden]{display:none!important}");
  });

  it("keeps the requested independent footer destinations on the shared layout", () => {
    for (const route of ["/integrations", "/product-updates", "/faq", "/user-guide", "/partners", "/careers", "/message-templates"]) {
      expect(appSource).toContain(`"${route}"`);
    }
    expect(appSource).toContain('class="footer-showcase-page');
  });
});
