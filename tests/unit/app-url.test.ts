import { afterEach, describe, expect, it } from "vitest";
import { appBaseUrl } from "../../src/server/app-url.js";

const original = {
  nodeEnv: process.env.NODE_ENV,
  publicUrl: process.env.NEXT_PUBLIC_APP_URL,
  authUrl: process.env.BETTER_AUTH_URL
};

afterEach(() => {
  for (const [key, value] of Object.entries({
    NODE_ENV: original.nodeEnv,
    NEXT_PUBLIC_APP_URL: original.publicUrl,
    BETTER_AUTH_URL: original.authUrl
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("public application URL", () => {
  it("uses the official HTTPS origin in production when configuration is absent", () => {
    process.env.NODE_ENV = "production";
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.BETTER_AUTH_URL;
    expect(appBaseUrl()).toBe("https://renvix.app");
  });

  it("rejects HTTP and credential-bearing public URLs in production", () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_APP_URL = "http://renvix.app";
    expect(() => appBaseUrl()).toThrow("HTTPS");
    process.env.NEXT_PUBLIC_APP_URL = "https://user:pass@renvix.app";
    expect(() => appBaseUrl()).toThrow("not safe");
  });
});
