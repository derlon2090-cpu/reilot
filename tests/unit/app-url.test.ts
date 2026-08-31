import { describe, expect, it } from "vitest";
import { adminBaseUrl, appBaseUrl, authBaseUrl, siteBaseUrl } from "../../src/server/app-url.js";

const productionEnv = {
  NODE_ENV: "production",
  NEXT_PUBLIC_SITE_URL: "https://renvix.app",
  NEXT_PUBLIC_AUTH_URL: "https://accounts.renvix.app",
  NEXT_PUBLIC_APP_URL: "https://dash.renvix.app",
  NEXT_PUBLIC_ADMIN_URL: "https://wa-admin.renvix.app"
} as NodeJS.ProcessEnv;

describe("canonical platform URLs", () => {
  it("keeps public, authentication, customer, and administration origins separate", () => {
    expect(siteBaseUrl(productionEnv)).toBe("https://renvix.app");
    expect(authBaseUrl(productionEnv)).toBe("https://accounts.renvix.app");
    expect(appBaseUrl(productionEnv)).toBe("https://dash.renvix.app");
    expect(adminBaseUrl(productionEnv)).toBe("https://wa-admin.renvix.app");
  });

  it("requires every canonical origin in production", () => {
    expect(() => appBaseUrl({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toThrow("NEXT_PUBLIC_APP_URL");
    expect(() => authBaseUrl({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toThrow("NEXT_PUBLIC_AUTH_URL");
    expect(() => siteBaseUrl({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toThrow("NEXT_PUBLIC_SITE_URL");
    expect(() => adminBaseUrl({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toThrow("NEXT_PUBLIC_ADMIN_URL");
  });

  it("rejects HTTP, credential-bearing, local, and Vercel production origins", () => {
    expect(() => appBaseUrl({ ...productionEnv, NEXT_PUBLIC_APP_URL: "http://dash.renvix.app" } as NodeJS.ProcessEnv)).toThrow("HTTPS");
    expect(() => appBaseUrl({ ...productionEnv, NEXT_PUBLIC_APP_URL: "https://user:pass@dash.renvix.app" } as NodeJS.ProcessEnv)).toThrow("not safe");
    expect(() => appBaseUrl({ ...productionEnv, NEXT_PUBLIC_APP_URL: "https://localhost" } as NodeJS.ProcessEnv)).toThrow("canonical");
    expect(() => appBaseUrl({ ...productionEnv, NEXT_PUBLIC_APP_URL: "https://preview.vercel.app" } as NodeJS.ProcessEnv)).toThrow("canonical");
  });
});
