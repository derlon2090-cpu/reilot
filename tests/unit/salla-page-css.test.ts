import { describe, expect, it } from "vitest";
import {
  normalizeSallaPageCssCode,
  sallaPageCssVariables
} from "../../src/data/sallaPageCss.js";

describe("Salla secure delivery page CSS", () => {
  it("keeps only the approved scoped design variables", () => {
    const source = `
      --salla-page-background: #f4fbf9;
      --salla-card-radius: 24px;
      color: red;
      --unknown-setting: 10px;
    `;
    expect(normalizeSallaPageCssCode(source)).toBe([
      "--salla-page-background: #f4fbf9;",
      "--salla-card-radius: 24px;"
    ].join("\n"));
    expect(sallaPageCssVariables(source)).toEqual({
      "--salla-page-background": "#f4fbf9",
      "--salla-card-radius": "24px"
    });
  });

  it.each([
    "--salla-page-background: url(https://evil.example/image.png);",
    "--salla-card-background: expression(alert(1));",
    "--salla-text-color: javascript:alert(1);",
    "@import 'https://evil.example/style.css';",
    "--salla-card-radius: 12px; } body { display:none;",
    "--salla-page-background: <script>alert(1)</script>;"
  ])("rejects executable or escaping CSS: %s", (source) => {
    expect(normalizeSallaPageCssCode(source)).toBe("");
    expect(sallaPageCssVariables(source)).toEqual({});
  });

  it("uses the last valid declaration and caps unsafe payload length", () => {
    const source = `${"/* padding */".repeat(600)}\n--salla-page-gap: 12px;\n--salla-page-gap: 18px;`;
    expect(sallaPageCssVariables(source)).toEqual({ "--salla-page-gap": "18px" });
  });
});
