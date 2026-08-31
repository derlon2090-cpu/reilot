import { afterEach, describe, expect, it } from "vitest";
import { adminSessionCookie, sessionCookie } from "../../src/server/session.js";

const originalNodeEnv = process.env.NODE_ENV;
const originalCookieSecure = process.env.COOKIE_SECURE;
const originalAuthCookieDomain = process.env.AUTH_COOKIE_DOMAIN;
const originalAppUrl = process.env.APP_URL;
const originalAuthUrl = process.env.AUTH_URL;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  if (originalCookieSecure === undefined) delete process.env.COOKIE_SECURE;
  else process.env.COOKIE_SECURE = originalCookieSecure;
  if (originalAuthCookieDomain === undefined) delete process.env.AUTH_COOKIE_DOMAIN;
  else process.env.AUTH_COOKIE_DOMAIN = originalAuthCookieDomain;
  if (originalAppUrl === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = originalAppUrl;
  if (originalAuthUrl === undefined) delete process.env.AUTH_URL;
  else process.env.AUTH_URL = originalAuthUrl;
});

describe("session cookie security", () => {
  it("sets Secure in production when an app URL is missing", () => {
    process.env.NODE_ENV = "production";
    delete process.env.COOKIE_SECURE;

    expect(sessionCookie("token")).toContain("; Secure");
  });

  it("sets Secure when COOKIE_SECURE is explicitly enabled", () => {
    process.env.NODE_ENV = "test";
    process.env.COOKIE_SECURE = "true";

    expect(sessionCookie("token")).toContain("; Secure");
  });

  it("allows the documented local HTTP override in a production build", () => {
    process.env.NODE_ENV = "production";
    process.env.COOKIE_SECURE = "false";

    expect(sessionCookie("token")).not.toContain("; Secure");
  });

  it("uses the explicit shared domain for the accounts-to-dashboard customer handoff", () => {
    process.env.NODE_ENV = "production";
    process.env.APP_URL = "https://renvix.app";
    process.env.AUTH_URL = "https://accounts.renvix.app";
    process.env.AUTH_COOKIE_DOMAIN = ".renvix.app";

    expect(sessionCookie("token")).toContain("; Domain=.renvix.app");
  });

  it("keeps administrator sessions host-only", () => {
    process.env.NODE_ENV = "production";
    process.env.COOKIE_SECURE = "true";
    process.env.AUTH_COOKIE_DOMAIN = ".renvix.app";

    const cookie = adminSessionCookie("admin-token", 3600);
    expect(cookie).not.toContain("; Domain=");
    expect(cookie).toContain("renvix_admin_session=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("; Secure");
  });

  it("does not attach the Renvix domain to unrelated preview hosts", () => {
    process.env.NODE_ENV = "production";
    process.env.APP_URL = "https://preview.example.net";
    process.env.AUTH_URL = "https://preview.example.net";
    delete process.env.AUTH_COOKIE_DOMAIN;

    expect(sessionCookie("token")).not.toContain("; Domain=");
  });
});
