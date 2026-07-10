import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { redactSecrets } from "../../src/lib/encryption.js";

describe("secrets leak security", () => {
  it("redacts sensitive keys from responses", () => {
    expect(redactSecrets({
      WHAPI_PARTNER_API_KEY: "whapi",
      DATABASE_URL: "postgres://prod",
      ENCRYPTION_KEY: "enc",
      nested: { channelToken: "channel-token" }
    })).toEqual({
      WHAPI_PARTNER_API_KEY: "[REDACTED]",
      DATABASE_URL: "[REDACTED]",
      ENCRYPTION_KEY: "[REDACTED]",
      nested: { channelToken: "[REDACTED]" }
    });
  });

  it("does not commit a local .env file", () => {
    expect(() => readFileSync(".env", "utf8")).toThrow();
  });
});
