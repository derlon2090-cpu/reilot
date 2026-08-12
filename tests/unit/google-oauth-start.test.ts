import { afterEach, describe, expect, it } from "vitest";
import { GET } from "../../app/api/auth/google/start/route.js";

const original = {
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  VERCEL: process.env.VERCEL,
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  AUTH_URL: process.env.AUTH_URL
};

afterEach(() => {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("Google OAuth backend ownership", () => {
  it("never executes the secret-backed exchange route on Vercel", async () => {
    process.env.NODE_ENV = "production";
    process.env.VERCEL = "1";
    process.env.AUTH_URL = "https://accounts.renvix.app";
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.renvix.app";
    const response = await GET(new Request("https://accounts.renvix.app/api/auth/google/start?locale=ar"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://api.renvix.app/api/auth/google/start?locale=ar");
  });

  it("fails closed on Vercel when no Render backend URL is configured", async () => {
    process.env.NODE_ENV = "production";
    process.env.VERCEL = "1";
    process.env.AUTH_URL = "https://accounts.renvix.app";
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    delete process.env.GOOGLE_CLIENT_ID;
    const response = await GET(new Request("https://accounts.renvix.app/api/auth/google/start?locale=en"));
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://accounts.renvix.app/login?google_error=auth_backend_required");
  });
});
