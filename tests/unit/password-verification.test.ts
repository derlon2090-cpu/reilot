import crypto from "node:crypto";
import { promisify } from "node:util";
import bcrypt from "bcryptjs";
import { afterEach, describe, expect, it } from "vitest";
import { hashPassword, needsRehash, verifyPassword } from "../../src/server/password.js";

const scrypt = promisify(crypto.scrypt);

afterEach(() => { delete process.env.PASSWORD_PEPPER; });

describe("production password service", () => {
  it("creates only an OWASP-minimum Argon2id PHC hash", async () => {
    const hash = await hashPassword("Test@12345");
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(hash).not.toContain("Test@12345");
    expect(needsRehash(hash)).toBe(false);
  });

  it("uses a unique random salt for the same password", async () => {
    const first = await hashPassword("Shared@Test123");
    const second = await hashPassword("Shared@Test123");
    expect(first).not.toBe(second);
    expect(Buffer.from(first.split("$")[4], "base64")).toHaveLength(16);
    expect(Buffer.from(second.split("$")[4], "base64")).toHaveLength(16);
  });

  it("verifies the correct password and rejects a wrong password", async () => {
    const hash = await hashPassword("Test@12345");
    await expect(verifyPassword("Test@12345", hash)).resolves.toBe(true);
    await expect(verifyPassword("Wrong@999", hash)).resolves.toBe(false);
  });

  it("supports a secret-manager pepper without embedding it in the PHC value", async () => {
    process.env.PASSWORD_PEPPER = "a-production-pepper-kept-outside-the-database-123";
    const hash = await hashPassword("Peppered@Test123");
    expect(hash).not.toContain(process.env.PASSWORD_PEPPER);
    await expect(verifyPassword("Peppered@Test123", hash)).resolves.toBe(true);
    process.env.PASSWORD_PEPPER = "a-different-production-pepper-value-456789";
    await expect(verifyPassword("Peppered@Test123", hash)).resolves.toBe(false);
  });

  it("fails closed for missing, plaintext, or malformed values", async () => {
    await expect(verifyPassword("Test@12345", null)).resolves.toBe(false);
    await expect(verifyPassword("Test@12345", "plain-text-password")).resolves.toBe(false);
    await expect(verifyPassword("Test@12345", "scrypt$missing$not-hex")).resolves.toBe(false);
    await expect(verifyPassword("x".repeat(1025), await hashPassword("Test@12345"))).resolves.toBe(false);
  });

  it("verifies bcrypt and scrypt only as legacy hashes and marks both for upgrade", async () => {
    const bcryptHash = await bcrypt.hash("Vx!2026KiteRiverStone", 10);
    await expect(verifyPassword("Vx!2026KiteRiverStone", bcryptHash)).resolves.toBe(true);
    expect(needsRehash(bcryptHash)).toBe(true);

    const salt = crypto.randomBytes(16).toString("hex");
    const derived = Buffer.from(await scrypt("Legacy@Test123", salt, 64) as Uint8Array).toString("hex");
    const legacyHash = `scrypt$${salt}$${derived}`;
    await expect(verifyPassword("Legacy@Test123", legacyHash)).resolves.toBe(true);
    expect(needsRehash(legacyHash)).toBe(true);
  });
});
