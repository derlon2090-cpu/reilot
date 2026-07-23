import { afterEach, describe, expect, it } from "vitest";
import { sessionCookie } from "../../src/server/session.js";

const originalNodeEnv = process.env.NODE_ENV;
const originalCookieSecure = process.env.COOKIE_SECURE;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  if (originalCookieSecure === undefined) delete process.env.COOKIE_SECURE;
  else process.env.COOKIE_SECURE = originalCookieSecure;
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
});
