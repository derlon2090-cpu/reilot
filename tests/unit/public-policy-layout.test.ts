import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../../src/app/app.js", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("../../src/styles/globals.css", import.meta.url), "utf8");
const footerSource = appSource.slice(
  appSource.indexOf("function publicFooter()"),
  appSource.indexOf("function marketingHomePage()")
);
const policySource = appSource.slice(
  appSource.indexOf("function policyPage()"),
  appSource.indexOf("function authPublicPage()")
);

describe("public legal policy layout", () => {
  it("shows all three legal destinations together in the footer", () => {
    expect(footerSource).toMatch(/data-link="\/terms"[\s\S]*data-link="\/privacy"[\s\S]*data-link="\/refund-policy"/);
    expect(footerSource).toContain("السياسات القانونية");
    expect(footerSource).toContain("سياسة الاستبدال والاسترجاع");
  });

  it("renders the shared hero, contents, support and section-card structure", () => {
    expect(policySource).toContain("policy-hero-pattern");
    expect(policySource).toContain("policy-hero-mark");
    expect(policySource).toContain("policy-updated");
    expect(policySource).toContain("policy-aside");
    expect(policySource).toContain("policy-help-card");
    expect(policySource).toContain("policy-card-icon");
    expect(policySource).toContain("policy-copy");
    expect(policySource).toContain("policy-contact-icon");
    expect(policySource).toContain("data-policy-anchor");
    expect(appSource).toContain("section.scrollIntoView");
  });

  it("keeps the reading layout responsive and keyboard-friendly", () => {
    expect(cssSource).toContain("grid-template-columns:236px minmax(0,1fr)");
    expect(cssSource).toContain(".policy-aside{position:sticky");
    expect(cssSource).toContain(".policy-page .policy-card");
    expect(cssSource).toContain(".policy-page .policy-summary a:focus-visible");
    expect(cssSource).toContain("@media(max-width:940px)");
    expect(cssSource).toContain("@media(max-width:640px)");
  });
});
