import { describe, expect, it } from "vitest";
import { isRenderAuthRuntime, publicAuthApiOrigin } from "../../src/server/auth-backend-runtime.js";

describe("authentication backend runtime", () => {
  it("rejects Vercel as the secret-bearing authentication backend", () => {
    expect(isRenderAuthRuntime({ NODE_ENV: "production", VERCEL: "1", RENDER: "true" } as NodeJS.ProcessEnv)).toBe(false);
  });

  it("accepts the Render production runtime", () => {
    expect(isRenderAuthRuntime({ NODE_ENV: "production", RENDER: "true" } as NodeJS.ProcessEnv)).toBe(true);
  });

  it("normalizes the public Render API origin", () => {
    expect(publicAuthApiOrigin({ NEXT_PUBLIC_API_BASE_URL: "https://api.renvix.app/path" } as NodeJS.ProcessEnv)).toBe("https://api.renvix.app");
  });
});
