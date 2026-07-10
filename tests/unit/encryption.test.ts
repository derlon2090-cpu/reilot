import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, redactSecrets } from "../../src/lib/encryption.js";

describe("encryption", () => {
  it("encrypts instance tokens and decrypts only with the server key", () => {
    const encrypted = encryptSecret("instance-token", "server-encryption-key");

    expect(encrypted).not.toContain("instance-token");
    expect(decryptSecret(encrypted, "server-encryption-key")).toBe("instance-token");
    expect(() => encryptSecret("token", "")).toThrow("ENCRYPTION_KEY is required");
  });

  it("redacts secrets from response payloads", () => {
    const response = redactSecrets({
      instance_token: "secret",
      nested: { DATABASE_URL: "postgres://prod" },
      public: "ok"
    });

    expect(response.instance_token).toBe("[REDACTED]");
    expect(response.nested.DATABASE_URL).toBe("[REDACTED]");
    expect(response.public).toBe("ok");
  });
});
