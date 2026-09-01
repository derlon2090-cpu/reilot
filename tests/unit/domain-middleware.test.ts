import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { isStaticAssetPath, middlewareRequest } from "../../middleware.js";

const keys = [
  "NODE_ENV", "NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_AUTH_URL", "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_ADMIN_URL", "NEXT_PUBLIC_API_BASE_URL", "API_PUBLIC_URL",
  "CLOUDFLARE_ACCESS_TEAM_DOMAIN", "CLOUDFLARE_ACCESS_AUD"
] as const;
const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
const allowAccess = vi.fn(async () => ({ ok: true as const, payload: { sub: "access-user" } }));
const recordHoneypot = vi.fn(async () => ({ ok: true as const }));

function request(url: string, session: "customer" | "admin" | "none" = "none", extraHeaders: Record<string, string> = {}) {
  const parsed = new URL(url);
  const cookie = session === "customer"
    ? "renewpilot_session=customer-session"
    : session === "admin"
      ? "renvix_admin_session=admin-session"
      : "";
  return new NextRequest(url, {
    headers: { host: parsed.host, ...(cookie ? { cookie } : {}), ...extraHeaders }
  });
}

function run(url: string, session: "customer" | "admin" | "none" = "none") {
  return middlewareRequest(request(url, session), { verifyAccess: allowAccess, recordHoneypot });
}

beforeEach(() => {
  allowAccess.mockClear();
  recordHoneypot.mockClear();
  process.env.NODE_ENV = "production";
  process.env.NEXT_PUBLIC_SITE_URL = "https://renvix.app";
  process.env.NEXT_PUBLIC_AUTH_URL = "https://accounts.renvix.app";
  process.env.NEXT_PUBLIC_APP_URL = "https://dash.renvix.app";
  process.env.NEXT_PUBLIC_ADMIN_URL = "https://wa-admin.renvix.app";
  process.env.CLOUDFLARE_ACCESS_TEAM_DOMAIN = "aged-base-982a.cloudflareaccess.com";
  process.env.CLOUDFLARE_ACCESS_AUD = "test-audience";
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
  it.each([
    "/_next/static/css/admin.css",
    "/_next/static/chunks/admin.js",
    "/_next/image?url=%2Fassets%2Flogo.png&w=256&q=75",
    "/assets/logo.png",
    "/app/styles/main.css",
    "/app/assets/icon.svg",
    "/app/app.js",
    "/app/auth-turnstile.js",
    "/app/locales/ar.json",
    "/data/publicData.js",
    "/data/sallaPageCss.js",
    "/data/sallaTemplateUi.js",
    "/favicon.ico"
  ])("keeps the static asset %s on the administration deployment origin", async (path) => {
    const response = await run(`https://wa-admin.renvix.app${path}`);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
    expect(isStaticAssetPath(new URL(path, "https://wa-admin.renvix.app").pathname)).toBe(true);
    expect(allowAccess).not.toHaveBeenCalled();
    expect(recordHoneypot).not.toHaveBeenCalled();
  });

  it("keeps the public site and accounts portal on their requested hosts", async () => {
    const publicResponse = await run("https://renvix.app/pricing");
    const authResponse = await run("https://accounts.renvix.app/login");
    expect(publicResponse.headers.get("x-middleware-next")).toBe("1");
    expect(authResponse.headers.get("x-middleware-next")).toBe("1");
  });

  it("sends customer pages to dash and unauthenticated customers to accounts", async () => {
    const wrongHost = await run("https://renvix.app/dashboard/customers", "customer");
    expect(wrongHost.status).toBe(307);
    expect(wrongHost.headers.get("location")).toBe("https://dash.renvix.app/dashboard/customers");

    const signedOut = await run("https://dash.renvix.app/dashboard/customers");
    expect(signedOut.status).toBe(307);
    expect(signedOut.headers.get("location")).toBe("https://accounts.renvix.app/login?returnTo=%2Fdashboard%2Fcustomers");
  });

  it("redirects known public hosts to the canonical admin and rejects admin APIs", async () => {
    const adminPage = await run("https://dash.renvix.app/admin", "customer");
    expect(adminPage.status).toBe(307);
    expect(adminPage.headers.get("location")).toBe("https://wa-admin.renvix.app/admin");

    const adminApi = await run("https://dash.renvix.app/api/admin/overview", "customer");
    expect(adminApi.status).toBe(404);
    await expect(adminApi.json()).resolves.toMatchObject({ reason: "misdirected_host" });
  });

  it("returns an empty 404 for retired and Vercel deployment admin hosts", async () => {
    for (const url of [
      "https://wa.admin.renvix.app/admin",
      "https://preview-name.vercel.app/advanced-pro-control"
    ]) {
      const response = await run(url);
      expect(response.status).toBe(404);
      expect(response.headers.get("location")).toBeNull();
      expect(await response.text()).toBe("");
    }
  });

  it("never redirects sensitive admin APIs requested from retired or deployment hosts", async () => {
    for (const url of [
      "https://wa.admin.renvix.app/api/admin/overview",
      "https://preview-name.vercel.app/api/admin/overview"
    ]) {
      const response = await run(url);
      expect(response.status).toBe(404);
      expect(response.headers.get("location")).toBeNull();
    }
  });

  it("serves one uniform blank honeypot response for every reserved-host path", async () => {
    for (const path of ["/", "/random", "/admin", "/api/admin", "/.env", "/config", "/wp-admin", "/_next/static/app.js", "/assets/logo.svg"]) {
      const response = await run(`https://admin.renvix.app${path}`);
      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
      expect(await response.text()).toBe("");
    }
    expect(recordHoneypot).toHaveBeenCalledTimes(9);
    expect(allowAccess).not.toHaveBeenCalled();
  });

  it("intercepts the honeypot forwarded host before public routing", async () => {
    const response = await middlewareRequest(
      request("https://renvix.app/", "none", { "x-forwarded-host": "admin.renvix.app" }),
      { verifyAccess: allowAccess, recordHoneypot }
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(await response.text()).toBe("");
    expect(recordHoneypot).toHaveBeenCalledOnce();
    expect(allowAccess).not.toHaveBeenCalled();
  });

  it("fails closed when Cloudflare Access configuration is missing in production", async () => {
    delete process.env.CLOUDFLARE_ACCESS_AUD;
    const response = await middlewareRequest(request("https://wa-admin.renvix.app/admin"));
    expect(response.status).toBe(503);
    expect(await response.text()).toBe("");
  });

  it("requires Cloudflare Access before the Renvix admin session", async () => {
    const response = await middlewareRequest(request("https://wa-admin.renvix.app/admin", "admin"));
    expect(response.status).toBe(403);
    expect(await response.text()).toBe("");
  });

  it("does not treat a customer cookie as an administrator session", async () => {
    const response = await run("https://wa-admin.renvix.app/admin", "customer");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://wa-admin.renvix.app/advanced-pro-control");
    expect(allowAccess).toHaveBeenCalledOnce();
  });

  it("does not expose an arbitrary public page on the administration host", async () => {
    const response = await run("https://wa-admin.renvix.app/pricing");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://renvix.app/pricing");
  });

  it("accepts an admin session only after the Cloudflare assertion is valid", async () => {
    const response = await run("https://wa-admin.renvix.app/admin", "admin");
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(allowAccess).toHaveBeenCalledOnce();
  });

  it("does not make the Render backend depend on the Vercel Cloudflare assertion", async () => {
    const response = await middlewareRequest(request(
      "https://api.renvix.app/api/admin/overview",
      "admin",
      { "x-forwarded-host": "wa-admin.renvix.app" }
    ));
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(allowAccess).not.toHaveBeenCalled();
  });

  it("does not expose customer APIs from the administration host", async () => {
    const response = await run("https://wa-admin.renvix.app/api/customers", "customer");
    expect(response.status).toBe(404);
  });

  it("keeps the admin login and verification bridge on the administration host after Access", async () => {
    const login = await run("https://wa-admin.renvix.app/advanced-pro-control");
    const verification = await run("https://wa-admin.renvix.app/verify-email");
    expect(login.headers.get("x-middleware-next")).toBe("1");
    expect(verification.headers.get("x-middleware-next")).toBe("1");
    expect(allowAccess).toHaveBeenCalledTimes(2);
  });

  it("redirects legacy admin verification paths to canonical paths only after Access", async () => {
    const email = await run("https://wa-admin.renvix.app/auth/verify-email");
    const mfa = await run("https://wa-admin.renvix.app/auth/verify-mfa");
    expect(email.status).toBe(307);
    expect(email.headers.get("location")).toBe("https://wa-admin.renvix.app/verify-email");
    expect(mfa.headers.get("location")).toBe("https://wa-admin.renvix.app/verify-mfa");
    expect(allowAccess).toHaveBeenCalledTimes(2);
  });

  it("keeps customer email verification on the accounts host", async () => {
    const response = await run("https://accounts.renvix.app/verify-email");
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
    expect(allowAccess).not.toHaveBeenCalled();
  });
});
