import { describe, expect, it } from "vitest";
import { resolveObjectStorageEndpoint } from "../../src/server/attachments/object-storage.js";

describe("object storage configuration", () => {
  it("derives the standard R2 endpoint from the account id before any stale custom endpoint", () => {
    expect(resolveObjectStorageEndpoint({
      accountId: "0123456789abcdef0123456789abcdef",
      endpoint: "https://stale.invalid.example"
    })).toBe("https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com");
  });

  it("uses an explicit endpoint only when no R2 account id is configured", () => {
    expect(resolveObjectStorageEndpoint({ accountId: "", endpoint: "https://custom.example/" }))
      .toBe("https://custom.example");
  });
});
