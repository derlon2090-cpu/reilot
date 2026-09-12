import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  normalizeAccountPhone,
  normalizeCommercePlatform
} from "../../src/server/security.js";

const root = process.cwd();
const source = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("registration identity contract", () => {
  it.each([
    ["0551234567", "+966551234567"],
    ["551234567", "+966551234567"],
    ["966551234567", "+966551234567"],
    ["٠٥٥١٢٣٤٥٦٧", "+966551234567"]
  ])("normalizes Saudi mobile %s", (input, expected) => {
    expect(normalizeAccountPhone(input)).toBe(expected);
  });

  it("rejects invalid mobile numbers and unsupported commerce platforms", () => {
    expect(normalizeAccountPhone("12345")).toBe("");
    expect(normalizeCommercePlatform("magento")).toBe("");
  });

  it.each(["zid", "salla", "shopify", "wordpress"])("accepts %s", (platform) => {
    expect(normalizeCommercePlatform(platform)).toBe(platform);
  });

  it("enforces phone uniqueness in the database and captures platform choice", () => {
    const migration = source("drizzle/0092_registration_phone_and_commerce_platform.sql");
    expect(migration).toContain("users_account_phone_e164_unique_idx");
    expect(migration).toContain("auth_pending_registration_phone_unique_idx");
    expect(migration).toContain("commerce_platform IN ('zid','salla','shopify','wordpress')");
  });

  it("has no Google OAuth routes or client module", () => {
    expect(existsSync(resolve(root, "app/api/auth/google/route.js"))).toBe(false);
    expect(existsSync(resolve(root, "app/api/auth/google/start/route.js"))).toBe(false);
    expect(existsSync(resolve(root, "app/api/auth/google/callback/route.js"))).toBe(false);
    expect(existsSync(resolve(root, "src/app/auth-google.js"))).toBe(false);
    expect(existsSync(resolve(root, "src/server/google-oauth.js"))).toBe(false);
    expect(source("src/app/app.js")).not.toMatch(/auth-google|\/api\/auth\/google|google-login/i);
  });
});
