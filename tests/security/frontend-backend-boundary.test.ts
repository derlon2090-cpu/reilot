import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));

const forbiddenProviderSecrets = [
  "DEEPSEEK_API_KEY",
  "GEMINI_API_KEY",
  "DEEPGRAM_API_KEY",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "NEXT_PUBLIC_DEEPSEEK_API_KEY",
  "NEXT_PUBLIC_GEMINI_API_KEY",
  "NEXT_PUBLIC_DEEPGRAM_API_KEY"
];

describe("Vercel frontend and Render backend boundary", () => {
  it("proxies application API requests to the Render backend", () => {
    expect(vercel.rewrites).toContainEqual({
      source: "/api/:path*",
      destination: "https://api.renvix.app/api/:path*"
    });
  });

  it("does not configure provider or R2 secrets in Vercel", () => {
    const configuredNames = Object.keys(vercel.env || {});
    expect(configuredNames).not.toEqual(expect.arrayContaining(forbiddenProviderSecrets));
    expect(configuredNames.some((name) => name.startsWith("NEXT_PUBLIC_R2_"))).toBe(false);
  });
});
