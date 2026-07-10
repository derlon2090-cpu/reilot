import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, redactSecrets } from "../../src/lib/encryption.js";

describe("encryption", () => {
  it("encrypts channel tokens and decrypts only with the server key", () => {
    const encrypted = encryptSecret("channel-token", "server-encryption-key");

    expect(encrypted).not.toContain("channel-token");
    expect(decryptSecret(encrypted, "server-encryption-key")).toBe("channel-token");
    expect(() => encryptSecret("token", "")).toThrow("ENCRYPTION_KEY is required");
  });

  it("redacts secrets from response payloads", () => {
    const response = redactSecrets({
      channel_token: "secret",
      nested: { DATABASE_URL: "postgres://prod" },
      public: "ok"
    });

    expect(response.channel_token).toBe("[REDACTED]");
    expect(response.nested.DATABASE_URL).toBe("[REDACTED]");
    expect(response.public).toBe("ok");
  });
});
