import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("scripts/verify-live-media-system.mjs", "utf8");

describe("synthetic production media system gate", () => {
  it("requires an explicit synthetic-only confirmation and always cleans up", () => {
    expect(source).toContain('LIVE_SYSTEM_TEST_CONFIRM !== "renvix-synthetic-only"');
    expect(source).toContain("finally");
    expect(source).toContain("deletePrivateObjectsAndVerify");
    expect(source).toContain('DELETE FROM tenants WHERE id=$1');
  });

  it("verifies provider accounting, retry idempotency, cache reuse, and hard delete", () => {
    expect(source).toContain("verifyDeepSeekAccounting");
    expect(source).toContain("verifyProviderRetry");
    expect(source).toContain("LIVE_MEDIA_CACHE_RECHARGED");
    expect(source).toContain("LIVE_HARD_DELETE_R2_REMAINS");
    expect(source).toContain("LIVE_STORAGE_QUOTA_NOT_RELEASED");
  });

  it("does not log sensitive media content or storage identifiers", () => {
    expect(source).not.toMatch(/console\.(?:log|error)\([^\n]*(?:transcript|objectKey|upload\.url|process\.env)/);
    expect(source).toContain("No secret, transcript, signed URL, object key, or customer data was logged");
  });
});
