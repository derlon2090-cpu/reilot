import crypto from "node:crypto";
import { promisify } from "node:util";
import bcrypt from "bcryptjs";

const scrypt = promisify(crypto.scrypt);

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = await scrypt(String(password), salt, 64);
  return `scrypt$${salt}$${Buffer.from(derived).toString("hex")}`;
}

export async function hashBcryptPassword(password, rounds = 12) {
  return bcrypt.hash(String(password), rounds);
}

export async function verifyPassword(password, stored) {
  if (String(stored || "").startsWith("$2a$") || String(stored || "").startsWith("$2b$") || String(stored || "").startsWith("$2y$")) {
    return bcrypt.compare(String(password), String(stored));
  }
  const [algorithm, salt, expectedHex] = String(stored || "").split("$");
  if (algorithm !== "scrypt" || !salt || !expectedHex) return false;
  const actual = Buffer.from(await scrypt(String(password), salt, 64));
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
