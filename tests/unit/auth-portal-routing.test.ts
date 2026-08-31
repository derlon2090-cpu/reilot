import { describe, expect, it } from "vitest";
import {
  canonicalAuthPath,
  configuredAuthApiOrigin,
  configuredOrigins,
  isAdminApiPath,
  isAdminPagePath,
  isAuthPath,
  isDashboardPagePath,
  isSplitHostEnabled,
  platformHostKind,
  safeReturnTo,
  shouldProxyAuthApi
} from "../../src/shared/auth-portal.js";

const env = {
  NODE_ENV: "production",
  NEXT_PUBLIC_SITE_URL: "https://renvix.app",
  NEXT_PUBLIC_AUTH_URL: "https://accounts.renvix.app",
  NEXT_PUBLIC_APP_URL: "https://dash.renvix.app",
  NEXT_PUBLIC_ADMIN_URL: "https://wa-admin.renvix.app",
  NEXT_PUBLIC_API_BASE_URL: "https://api.renvix.app"
} as NodeJS.ProcessEnv;

describe("platform domain routing", () => {
  it("normalizes authentication routes and rejects unsafe return targets", () => {
    expect(canonicalAuthPath("/auth/verify-email")).toBe("/verify-email");
    expect(isAuthPath("/recovery")).toBe(true);
    expect(safeReturnTo("/dashboard/campaigns?tab=active")).toBe("/dashboard/campaigns?tab=active");
    expect(safeReturnTo("https://evil.example/steal")).toBe("/dashboard");
    expect(safeReturnTo("//evil.example/steal")).toBe("/dashboard");
    expect(safeReturnTo("/login")).toBe("/dashboard");
  });

  it("resolves all four canonical hosts", () => {
    const origins = configuredOrigins(env);
    expect(origins).toEqual({
      site: "https://renvix.app",
      auth: "https://accounts.renvix.app",
      app: "https://dash.renvix.app",
      admin: "https://wa-admin.renvix.app"
    });
    expect(isSplitHostEnabled(origins)).toBe(true);
    expect(platformHostKind("renvix.app", origins)).toBe("site");
    expect(platformHostKind("accounts.renvix.app", origins)).toBe("auth");
    expect(platformHostKind("dash.renvix.app", origins)).toBe("app");
    expect(platformHostKind("wa-admin.renvix.app", origins)).toBe("admin");
    expect(platformHostKind("admin.renvix.app", origins)).toBe("unknown");
  });

  it("classifies customer and administrator routes without overlap", () => {
    expect(isDashboardPagePath("/dashboard/customers")).toBe(true);
    expect(isDashboardPagePath("/login")).toBe(false);
    expect(isAdminPagePath("/admin/settings")).toBe(true);
    expect(isAdminPagePath("/advanced-pro-control")).toBe(true);
    expect(isAdminApiPath("/api/admin/users")).toBe(true);
    expect(isAdminApiPath("/api/customers")).toBe(false);
  });

  it("proxies secret-backed authentication calls to the API origin only", () => {
    const apiOrigin = configuredAuthApiOrigin(env);
    expect(apiOrigin).toBe("https://api.renvix.app");
    expect(shouldProxyAuthApi("/api/auth/login", "accounts.renvix.app", apiOrigin, env)).toBe(true);
    expect(shouldProxyAuthApi("/api/auth/session", "api.renvix.app", apiOrigin, env)).toBe(false);
    expect(shouldProxyAuthApi("/api/customers", "dash.renvix.app", apiOrigin, env)).toBe(false);
  });

  it("fails closed when a production URL points at a preview deployment", () => {
    expect(() => configuredOrigins({ ...env, NEXT_PUBLIC_APP_URL: "https://preview.vercel.app" } as NodeJS.ProcessEnv)).toThrow("canonical");
  });
});
