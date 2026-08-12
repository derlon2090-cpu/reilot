import { afterEach, describe, expect, it } from "vitest";
import { appBaseUrl, authBaseUrl } from "../../src/server/app-url.js";

const original = {
  nodeEnv: process.env.NODE_ENV,
  publicUrl: process.env.NEXT_PUBLIC_APP_URL,
  authUrl: process.env.BETTER_AUTH_URL,
  splitAuthUrl: process.env.AUTH_URL,
  splitHostEnabled: process.env.AUTH_SPLIT_HOST_ENABLED
};

afterEach(() => {
  for (const [key, value] of Object.entries({
    NODE_ENV: original.nodeEnv,
    NEXT_PUBLIC_APP_URL: original.publicUrl,
    BETTER_AUTH_URL: original.authUrl,
    AUTH_URL: original.splitAuthUrl,
    AUTH_SPLIT_HOST_ENABLED: original.splitHostEnabled
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

  it("ignores a stale split authentication host until it is explicitly enabled", () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_APP_URL = "https://renvix.app";
    process.env.AUTH_URL = "https://accounts.renvix.app";
    delete process.env.AUTH_SPLIT_HOST_ENABLED;
    expect(authBaseUrl()).toBe("https://renvix.app");
    process.env.AUTH_SPLIT_HOST_ENABLED = "true";
    expect(authBaseUrl()).toBe("https://accounts.renvix.app");
  });
});
