import { afterEach, describe, expect, it } from "vitest";
import { GET } from "../../app/api/auth/google/start/route.js";

const original = {
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET
};

afterEach(() => {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("Google OAuth start diagnostics", () => {
  it("identifies a missing server secret without exposing values", async () => {
    process.env.GOOGLE_CLIENT_ID = "web-client.apps.googleusercontent.com";
    delete process.env.GOOGLE_CLIENT_SECRET;
    const response = await GET(new Request("https://accounts.renvix.app/api/auth/google/start?locale=ar"));
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://accounts.renvix.app/login?google_error=missing_client_secret");
  });

  it("identifies a missing client id", async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    process.env.GOOGLE_CLIENT_SECRET = "server-only-secret";
    const response = await GET(new Request("https://accounts.renvix.app/api/auth/google/start?locale=en"));
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://accounts.renvix.app/login?google_error=missing_client_id");
  });
});
