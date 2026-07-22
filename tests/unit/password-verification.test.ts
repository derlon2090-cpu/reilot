import { describe, expect, it } from "vitest";
import { hashBcryptPassword, hashPassword, verifyPassword } from "../../src/server/password.js";

describe("password verification", () => {
  it("accepts only the password used to create the hash", async () => {
    const hash = await hashPassword("Test@12345");
    await expect(verifyPassword("Test@12345", hash)).resolves.toBe(true);
    await expect(verifyPassword("Wrong@999", hash)).resolves.toBe(false);
  });

  it("fails closed for missing or malformed password hashes", async () => {
    await expect(verifyPassword("Test@12345", null)).resolves.toBe(false);
    await expect(verifyPassword("Test@12345", "plain-text-password")).resolves.toBe(false);
    await expect(verifyPassword("Test@12345", "scrypt$missing$not-hex")).resolves.toBe(false);
  });

  it("verifies bcrypt hashes created by the first-admin setup flow", async () => {
    const hash = await hashBcryptPassword("Vx!2026KiteRiverStone", 10);
    expect(hash).toMatch(/^\$2[aby]\$/);
    await expect(verifyPassword("Vx!2026KiteRiverStone", hash)).resolves.toBe(true);
    await expect(verifyPassword("Wrong!2026Value", hash)).resolves.toBe(false);
  });
});
