import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const fixtureRoot = resolve("tests/fixtures/media-eval");
const manifest = JSON.parse(readFileSync(resolve(fixtureRoot, "manifest.json"), "utf8"));
const samples = Array.isArray(manifest.samples) ? manifest.samples : [];

describe("non-sensitive media evaluation corpus", () => {
  it("contains the required Arabic, English, mixed, and image samples", () => {
    const audio = samples.filter((sample: { type: string }) => sample.type === "audio");
    const images = samples.filter((sample: { type: string }) => sample.type === "image");

    expect(audio.length).toBeGreaterThanOrEqual(6);
    expect(images.length).toBeGreaterThanOrEqual(3);
    expect(audio.some((sample: { locale?: string }) => sample.locale === "ar-SA")).toBe(true);
    expect(audio.some((sample: { locale?: string }) => sample.locale === "en-US")).toBe(true);
    expect(audio.some((sample: { requiredTerms?: string[] }) => sample.requiredTerms?.includes("WhatsApp"))).toBe(true);
  });

  it("references non-empty local files only", () => {
    for (const sample of samples) {
      expect(sample.path).toMatch(/^(audio|images)\/[A-Za-z0-9._-]+$/);
      expect(statSync(resolve(fixtureRoot, sample.path)).size).toBeGreaterThan(1024);
    }
  });

  it("does not embed credentials or signed URLs", () => {
    const serialized = JSON.stringify(manifest);
    expect(serialized).not.toMatch(/(?:api[_-]?key|secret|authorization|x-amz-signature|presigned|bearer\s)/i);
    expect(serialized).not.toMatch(/https?:\/\//i);
  });
});
