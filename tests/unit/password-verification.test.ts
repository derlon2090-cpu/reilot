import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../../src/server/password.js";

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
});
