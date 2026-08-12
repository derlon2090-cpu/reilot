import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("Turnstile content security policy", () => {
  const config = readFileSync("next.config.mjs", "utf8");

  it("allows only the official challenge origin for widget resources", () => {
    expect(config).toMatch(/script-src[^;]+https:\/\/challenges\.cloudflare\.com/);
    expect(config).toMatch(/connect-src[^;]+https:\/\/challenges\.cloudflare\.com/);
    expect(config).toMatch(/frame-src[^;]+https:\/\/challenges\.cloudflare\.com/);
  });
});
