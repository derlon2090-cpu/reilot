import crypto from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { GET } from "../../app/api/auth/google/config/route.js";

const original = {
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  NODE_ENV: process.env.NODE_ENV,
  RENDER: process.env.RENDER,
  VERCEL: process.env.VERCEL
};

afterEach(() => {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("Google backend configuration", () => {
  it("serves the normalized public client ID from Render without exposing a secret", async () => {
    process.env.NODE_ENV = "production";
    process.env.RENDER = "true";
    delete process.env.VERCEL;
    process.env.GOOGLE_CLIENT_ID = "https://web-client.apps.googleusercontent.com/";

    const response = await GET(new Request("https://api.renvix.app/api/auth/google/config", {
      headers: { Origin: "https://accounts.renvix.app" }
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://accounts.renvix.app");
    expect(payload).toEqual({
      ok: true,
      clientId: "web-client.apps.googleusercontent.com",
      clientIdFingerprint: crypto.createHash("sha256").update("web-client.apps.googleusercontent.com").digest("hex")
    });
    expect(JSON.stringify(payload)).not.toContain("secret");
  });
});
