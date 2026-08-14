import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("scripts/evaluate-media-providers.mjs", "utf8");

describe("live media evaluation release gate", () => {
  it("fails the process for weak quality or missing provider usage", () => {
    expect(source).toContain("maximumAudioWordErrorRate");
    expect(source).toContain("minimumImagePhraseRecall");
    expect(source).toContain("!item.deepgramUsageConfirmed");
    expect(source).toContain("!item.usageConfirmed");
    expect(source).toContain("if (!report.ok) process.exitCode = 1");
  });

  it("does not include full transcript fields in the emitted result", () => {
    expect(source).not.toMatch(/results\.push\(\{[^}]*transcript\s*:/s);
    expect(source).not.toContain("providerRequestId: primary.providerRequestId");
  });
});
