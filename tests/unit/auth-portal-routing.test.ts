import { describe, expect, it } from "vitest";
import {
  canonicalAuthPath,
  configuredOrigins,
  isAuthPath,
  isSplitHostEnabled,
  safeReturnTo
} from "../../src/shared/auth-portal.js";
import { sessionCookie } from "../../src/server/session.js";

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

  it("ignores a stale authentication host until split hosting is explicitly enabled", () => {
    const origins = configuredOrigins({ NODE_ENV: "production", APP_URL: "https://renvix.app", AUTH_URL: "https://accounts.renvix.app" });
    expect(origins).toEqual({ app: "https://renvix.app", auth: "https://renvix.app" });
    expect(isSplitHostEnabled(origins)).toBe(false);
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
});
