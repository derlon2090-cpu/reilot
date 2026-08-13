import { describe, expect, it } from "vitest";
import {
  canonicalAuthPath,
  configuredAuthApiOrigin,
  configuredOrigins,
  isAuthPath,
  isSplitHostEnabled,
  safeReturnTo,
  shouldProxyAuthApi
} from "../../src/shared/auth-portal.js";
import { sessionCookie } from "../../src/server/session.js";
import { readFileSync } from "node:fs";

describe("accounts authentication portal", () => {
  it("normalizes transitional verification routes", () => {
    expect(canonicalAuthPath("/auth/verify-email")).toBe("/verify-email");
    expect(canonicalAuthPath("/auth/verify-mfa")).toBe("/verify-mfa");
    expect(isAuthPath("/recovery")).toBe(true);
    expect(isAuthPath("/dashboard")).toBe(false);
  });

  it("accepts only local application return paths", () => {
    expect(safeReturnTo("/dashboard/campaigns?tab=active")).toBe("/dashboard/campaigns?tab=active");
    expect(safeReturnTo("https://evil.example/steal")).toBe("/dashboard");
    expect(safeReturnTo("//evil.example/steal")).toBe("/dashboard");
    expect(safeReturnTo("/login")).toBe("/dashboard");
  });

  it("uses separate production app and authentication hosts", () => {
    const origins = configuredOrigins({ NODE_ENV: "production", APP_URL: "https://renvix.app", AUTH_URL: "https://accounts.renvix.app", AUTH_SPLIT_HOST_ENABLED: "true" });
    expect(origins).toEqual({ app: "https://renvix.app", auth: "https://accounts.renvix.app" });
    expect(isSplitHostEnabled(origins)).toBe(true);
  });

  it("keeps authentication on the application host until AUTH_URL is configured", () => {
    const origins = configuredOrigins({ NODE_ENV: "production", APP_URL: "https://renvix.app" });
    expect(origins).toEqual({ app: "https://renvix.app", auth: "https://renvix.app" });
    expect(isSplitHostEnabled(origins)).toBe(false);
  });

  it("routes secret-backed authentication requests from Vercel to Render", () => {
    const env = { NODE_ENV: "production", NEXT_PUBLIC_API_BASE_URL: "https://api.renvix.app" };
    const apiOrigin = configuredAuthApiOrigin(env);
    expect(apiOrigin).toBe("https://api.renvix.app");
    expect(shouldProxyAuthApi("/api/auth/login", "accounts.renvix.app", apiOrigin, env)).toBe(true);
    expect(shouldProxyAuthApi("/api/auth/register", "renvix.app", apiOrigin, env)).toBe(true);
    expect(shouldProxyAuthApi("/api/auth/session", "api.renvix.app", apiOrigin, env)).toBe(false);
  });

  it("forwards only the registered Google callback to the secret-owning backend", () => {
    const env = { NODE_ENV: "production", NEXT_PUBLIC_API_BASE_URL: "https://api.renvix.app" };
    const apiOrigin = configuredAuthApiOrigin(env);
    expect(shouldProxyAuthApi("/api/auth/google/start", "accounts.renvix.app", apiOrigin, env)).toBe(false);
    expect(shouldProxyAuthApi("/api/auth/google/callback", "accounts.renvix.app", apiOrigin, env)).toBe(true);
  });

  it("ignores a stale authentication host until split hosting is explicitly enabled", () => {
    const origins = configuredOrigins({ NODE_ENV: "production", APP_URL: "https://renvix.app", AUTH_URL: "https://accounts.renvix.app" });
    expect(origins).toEqual({ app: "https://renvix.app", auth: "https://renvix.app" });
    expect(isSplitHostEnabled(origins)).toBe(false);
  });

  it("normalizes an internal Vercel app origin to the public production domain", () => {
    const origins = configuredOrigins({ NODE_ENV: "production", APP_URL: "https://reilot.vercel.app" });
    expect(origins).toEqual({ app: "https://renvix.app", auth: "https://renvix.app" });
  });

  it("issues a shared secure HttpOnly session cookie", () => {
    const previous = { secure: process.env.COOKIE_SECURE, auth: process.env.AUTH_URL, domain: process.env.AUTH_COOKIE_DOMAIN };
    process.env.COOKIE_SECURE = "true";
    process.env.AUTH_URL = "https://accounts.renvix.app";
    process.env.AUTH_COOKIE_DOMAIN = ".renvix.app";
    try {
      const value = sessionCookie("test-token");
      expect(value).toContain("HttpOnly");
      expect(value).toContain("SameSite=Lax");
      expect(value).toContain("Domain=.renvix.app");
      expect(value).toContain("Secure");
    } finally {
      if (previous.secure === undefined) delete process.env.COOKIE_SECURE; else process.env.COOKIE_SECURE = previous.secure;
      if (previous.auth === undefined) delete process.env.AUTH_URL; else process.env.AUTH_URL = previous.auth;
      if (previous.domain === undefined) delete process.env.AUTH_COOKIE_DOMAIN; else process.env.AUTH_COOKIE_DOMAIN = previous.domain;
    }
  });

  it("keeps authentication static modules on the accounts host", () => {
    const middlewareSource = readFileSync("middleware.js", "utf8");
    expect(middlewareSource).toContain("|app/|assets/|data/");
    expect(middlewareSource).toContain("NextResponse.rewrite(target)");
  });

  it("sends client-side authentication entry directly to the configured portal", () => {
    const appSource = readFileSync("src/app/app.js", "utf8");
    expect(appSource).toContain("function enterAuthPortal(to)");
    expect(appSource).toContain("if (enterAuthPortal(to)) return;");
    expect(appSource).toContain("location.assign(new URL(`${requested.pathname}${requested.search}${requested.hash}`, authOrigin).toString())");
  });

  it("migrates an accounts-only session before redirecting to the app host", () => {
    const pageSource = readFileSync("app/[[...slug]]/page.jsx", "utf8");
    expect(pageSource).toContain('new URL("/api/auth/session/continue", authBaseUrl())');
    expect(pageSource).not.toContain('redirect(new URL("/dashboard", appBaseUrl()).toString())');
  });
});
