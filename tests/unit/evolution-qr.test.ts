import { describe, expect, it } from "vitest";
import { isEvolutionInstanceMissing, normalizeEvolutionQr } from "../../src/server/evolution-client.js";

describe("normalizeEvolutionQr", () => {
  it("accepts only sufficiently sized PNG or JPEG payloads", () => {
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(900)
    ]).toString("base64");

    expect(normalizeEvolutionQr(png)).toBe(`data:image/png;base64,${png}`);
    expect(normalizeEvolutionQr("base64-qr")).toBeNull();
    expect(normalizeEvolutionQr(Buffer.alloc(900).toString("base64"))).toBeNull();
    expect(normalizeEvolutionQr("data:image/svg+xml;base64,PHN2Zz4=")).toBeNull();
  });

  it("recognizes a missing provider instance without masking other failures", () => {
    expect(isEvolutionInstanceMissing(new Error("Evolution API 404: instance does not exist"))).toBe(true);
    expect(isEvolutionInstanceMissing(new Error("Evolution API 503: unavailable"))).toBe(false);
  });
});
