import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../../middleware.js";

const keys = [
  "NODE_ENV", "NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_AUTH_URL", "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_ADMIN_URL", "NEXT_PUBLIC_API_BASE_URL", "API_PUBLIC_URL"
] as const;
const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

function request(url: string, authenticated = false) {
  const parsed = new URL(url);
  return new NextRequest(url, {
    headers: {
      host: parsed.host,
      ...(authenticated ? { cookie: "renewpilot_session=customer-session" } : {})
    }
  });
}

beforeEach(() => {
  process.env.NODE_ENV = "production";
  process.env.NEXT_PUBLIC_SITE_URL = "https://renvix.app";
  process.env.NEXT_PUBLIC_AUTH_URL = "https://accounts.renvix.app";
  process.env.NEXT_PUBLIC_APP_URL = "https://dash.renvix.app";
  process.env.NEXT_PUBLIC_ADMIN_URL = "https://admin.renvix.app";
  delete process.env.NEXT_PUBLIC_API_BASE_URL;
  delete process.env.API_PUBLIC_URL;
});

afterEach(() => {
  for (const key of keys) {
    const value = original[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("canonical domain middleware", () => {
  it("keeps the public site and accounts portal on their requested hosts", async () => {
    const publicResponse = await middleware(request("https://renvix.app/pricing"));
    const authResponse = await middleware(request("https://accounts.renvix.app/login"));
    expect(publicResponse.headers.get("x-middleware-next")).toBe("1");
    expect(authResponse.headers.get("x-middleware-next")).toBe("1");
  });

  it("sends customer pages to dash and unauthenticated customers to accounts", async () => {
    const wrongHost = await middleware(request("https://renvix.app/dashboard/customers", true));
    expect(wrongHost.status).toBe(307);
    expect(wrongHost.headers.get("location")).toBe("https://dash.renvix.app/dashboard/customers");

    const signedOut = await middleware(request("https://dash.renvix.app/dashboard/customers"));
    expect(signedOut.status).toBe(307);
    expect(signedOut.headers.get("location")).toBe("https://accounts.renvix.app/login?returnTo=%2Fdashboard%2Fcustomers");
  });

  it("keeps admin pages on admin and rejects admin APIs on dash", async () => {
    const adminPage = await middleware(request("https://dash.renvix.app/admin", true));
    expect(adminPage.status).toBe(307);
    expect(adminPage.headers.get("location")).toBe("https://admin.renvix.app/admin");

    const adminApi = await middleware(request("https://dash.renvix.app/api/admin/overview", true));
    expect(adminApi.status).toBe(404);
    await expect(adminApi.json()).resolves.toMatchObject({ reason: "misdirected_host" });
  });

  it("does not treat a customer cookie as an administrator session", async () => {
    const response = await middleware(request("https://admin.renvix.app/admin", true));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://admin.renvix.app/advanced-pro-control");
  });

  it("does not expose customer APIs from the administration host", async () => {
    const response = await middleware(request("https://admin.renvix.app/api/customers", true));
    expect(response.status).toBe(404);
  });

  it("keeps the admin login and verification bridge on the administration host", async () => {
    const login = await middleware(request("https://admin.renvix.app/advanced-pro-control"));
    const verification = await middleware(request("https://admin.renvix.app/verify-email"));
    expect(login.headers.get("x-middleware-next")).toBe("1");
    expect(verification.headers.get("x-middleware-next")).toBe("1");
  });
});
