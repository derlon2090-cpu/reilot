import { describe, expect, it } from "vitest";
import { decodeStoragePasswordHeader, storageDocumentPasswordFromRequest } from "../../src/server/storage-password-headers.js";

const encode = (value: string) => Buffer.from(value, "utf8").toString("base64url");

describe("Storage Center password headers", () => {
  it("round trips Arabic, symbols, and emoji as UTF-8", () => {
    const password = "كلمة-مرور🔐 قوية!";
    const encoded = encode(password);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeStoragePasswordHeader(encoded, 1024)).toBe(password);
    const request = new Request("https://api.renvix.app", { headers: { "X-Storage-Document-Password-B64": encoded } });
    expect(storageDocumentPasswordFromRequest(request)).toBe(password);
  });

  it("keeps legacy ASCII headers compatible and rejects malformed encoding", () => {
    const legacy = new Request("https://api.renvix.app", { headers: { "X-Storage-Document-Password": "LegacyPassword1!" } });
    expect(storageDocumentPasswordFromRequest(legacy)).toBe("LegacyPassword1!");
    expect(decodeStoragePasswordHeader("not+base64", 1024)).toBe("");
  });
});
