import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.CUSTOM_API_KEY_PEPPER = "custom-api-test-pepper-that-is-long-enough";
  process.env.CUSTOM_INTEGRATION_ENCRYPTION_KEY = "custom-webhook-encryption-key-long-enough";
});

describe("custom integration security", () => {
  it("creates one-time API keys and verifies only the original", async () => {
    const { createApiKey, parseApiKey, verifyApiKeyDigest } = await import("../../src/server/custom-integrations.js");
    const key = createApiKey("live");
    expect(key.raw).toMatch(/^rvx_live_[a-f0-9]{32}_[A-Za-z0-9_-]{40,}$/);
    expect(parseApiKey(key.raw)).toMatchObject({ environment: "live", publicKeyId: key.publicKeyId });
    expect(key.digest).not.toContain(key.raw);
    expect(verifyApiKeyDigest(key.raw, key.digest)).toBe(true);
    expect(verifyApiKeyDigest(`${key.raw}x`, key.digest)).toBe(false);
  });

  it("signs the exact timestamp and raw body", async () => {
    const { signWebhook } = await import("../../src/server/custom-integrations.js");
    const first = signWebhook({ secret: "secret", timestamp: "123", rawBody: "{\"ok\":true}" });
    const second = signWebhook({ secret: "secret", timestamp: "124", rawBody: "{\"ok\":true}" });
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toBe(second);
  });

  it("rejects private IP ranges and uses the required retry schedule", async () => {
    const { isPublicIp, retryDelaySeconds } = await import("../../src/server/custom-integrations.js");
    expect(isPublicIp("127.0.0.1")).toBe(false);
    expect(isPublicIp("10.0.0.4")).toBe(false);
    expect(isPublicIp("169.254.169.254")).toBe(false);
    expect(isPublicIp("8.8.8.8")).toBe(true);
    expect([0,1,2,3,4,5,6].map(retryDelaySeconds)).toEqual([0,60,300,900,3600,21600,86400]);
  });

  it("derives isolated custom-integration secrets from the platform secret", async () => {
    const previousPepper = process.env.CUSTOM_API_KEY_PEPPER;
    const previousEncryptionKey = process.env.CUSTOM_INTEGRATION_ENCRYPTION_KEY;
    const previousPlatformKey = process.env.ENCRYPTION_KEY;

    delete process.env.CUSTOM_API_KEY_PEPPER;
    delete process.env.CUSTOM_INTEGRATION_ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = "platform-encryption-secret-that-is-long-enough";

    try {
      const {
        createApiKey,
        decryptWebhookSecret,
        encryptWebhookSecret,
        verifyApiKeyDigest
      } = await import("../../src/server/custom-integrations.js");
      const apiKey = createApiKey("test");
      const encrypted = encryptWebhookSecret("whsec_example_secret");

      expect(verifyApiKeyDigest(apiKey.raw, apiKey.digest)).toBe(true);
      expect(encrypted).not.toContain("whsec_example_secret");
      expect(decryptWebhookSecret(encrypted)).toBe("whsec_example_secret");
    } finally {
      if (previousPepper === undefined) delete process.env.CUSTOM_API_KEY_PEPPER;
      else process.env.CUSTOM_API_KEY_PEPPER = previousPepper;
      if (previousEncryptionKey === undefined) delete process.env.CUSTOM_INTEGRATION_ENCRYPTION_KEY;
      else process.env.CUSTOM_INTEGRATION_ENCRYPTION_KEY = previousEncryptionKey;
      if (previousPlatformKey === undefined) delete process.env.ENCRYPTION_KEY;
      else process.env.ENCRYPTION_KEY = previousPlatformKey;
    }
  });
});
