import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("scripts/smoke-r2.mjs", "utf8");

describe("R2 live smoke release gate", () => {
  it("covers the complete private object lifecycle and cleans up on failure", () => {
    expect(source).toContain("createPrivateUpload");
    expect(source).toContain("inspectPrivateObject");
    expect(source).toContain("createPrivateDownload");
    expect(source).toContain("timingSafeEqual");
    expect(source).toContain("deletePrivateObjectsAndVerify");
    expect(source).toContain("finally");
  });

  it("does not print server credentials, signed URLs, or object keys", () => {
    expect(source).not.toMatch(/console\.(?:log|error)\([^\n]*(?:url|objectKey|process\.env)/);
    expect(source).toContain("No credential or object key was logged");
  });
});
