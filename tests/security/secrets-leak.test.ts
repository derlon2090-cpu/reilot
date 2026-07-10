import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { redactSecrets } from "../../src/lib/encryption.js";

describe("secrets leak security", () => {
  it("redacts sensitive keys from responses", () => {
    expect(redactSecrets({
      EVOLUTION_API_KEY: "evolution-key",
      EVOLUTION_WEBHOOK_SECRET: "webhook-secret",
      DATABASE_URL: "postgres://prod",
      ENCRYPTION_KEY: "enc",
      nested: { instanceToken: "instance-token" }
    })).toEqual({
      EVOLUTION_API_KEY: "[REDACTED]",
      EVOLUTION_WEBHOOK_SECRET: "[REDACTED]",
      DATABASE_URL: "[REDACTED]",
      ENCRYPTION_KEY: "[REDACTED]",
      nested: { instanceToken: "[REDACTED]" }
    });
  });

  it("does not commit a local .env file", () => {
    expect(() => readFileSync(".env", "utf8")).toThrow();
  });
});
