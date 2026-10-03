import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync("src/app/app.js", "utf8");
const homeSource = appSource.slice(
  appSource.indexOf("function marketingHomePage()"),
  appSource.indexOf("function marketingMobileHomeNetwork()")
);

describe("marketing home support strip", () => {
  it("does not render the redundant support strip on the main page", () => {
    expect(appSource).not.toContain("function homeSupportSection()");
    expect(homeSource).not.toContain("homeSupportSection()");
    expect(homeSource).not.toContain('class="home-section home-support"');
  });
});
