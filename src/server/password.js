import crypto from "node:crypto";
import { promisify } from "node:util";
import argon2 from "argon2";
import bcrypt from "bcryptjs";

const legacyScrypt = promisify(crypto.scrypt);
const ARGON2_OPTIONS = Object.freeze({
  type: argon2.argon2id,
  version: 0x13,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  hashLength: 32
});
const MAX_PASSWORD_BYTES = 1024;

function passwordBuffer(password) {
  const value = String(password ?? "");
  const buffer = Buffer.from(value, "utf8");
  if (!buffer.length || buffer.length > MAX_PASSWORD_BYTES) {
    buffer.fill(0);
    const error = new Error("Password length is invalid");
    error.code = "INVALID_PASSWORD_LENGTH";
    throw error;
  }
  return buffer;
}

function pepperBuffer() {
  const pepper = String(process.env.PASSWORD_PEPPER || "");
  if (!pepper) return null;
  const buffer = Buffer.from(pepper, "utf8");
  if (buffer.length < 32) {
    buffer.fill(0);
    const error = new Error("PASSWORD_PEPPER must contain at least 32 bytes");
    error.code = "AUTH_CONFIGURATION_ERROR";
    throw error;
  }
  return buffer;
}

export async function hashPassword(password) {
  const secret = passwordBuffer(password);
  const pepper = pepperBuffer();
  try {
    return await argon2.hash(secret, {
      ...ARGON2_OPTIONS,
      salt: crypto.randomBytes(16),
      ...(pepper ? { secret: pepper } : {})
    });
  } finally {
    secret.fill(0);
    pepper?.fill(0);
  }
}

export async function verifyPassword(password, storedHash) {
  const stored = String(storedHash || "");
  const candidate = String(password ?? "");
  const candidateBytes = Buffer.byteLength(candidate, "utf8");
  if (!stored || !candidateBytes || candidateBytes > MAX_PASSWORD_BYTES) return false;
  try {
    if (stored.startsWith("$argon2id$")) {
      const secret = passwordBuffer(candidate);
      const pepper = pepperBuffer();
      try {
        return await argon2.verify(stored, secret, pepper ? { secret: pepper } : {});
      } finally {
        secret.fill(0);
        pepper?.fill(0);
      }
    }
    if (/^\$2[aby]\$/.test(stored)) {
      return await bcrypt.compare(candidate, stored);
    }
    const [algorithm, salt, expectedHex, extra] = stored.split("$");
    if (algorithm !== "scrypt" || !salt || !/^[a-f0-9]{128}$/i.test(expectedHex || "") || extra) return false;
    const actual = Buffer.from(await legacyScrypt(candidate, salt, 64));
    const expected = Buffer.from(expectedHex, "hex");
    const valid = actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
    actual.fill(0);
    expected.fill(0);
    return valid;
  } catch (error) {
    if (error?.code === "AUTH_CONFIGURATION_ERROR") throw error;
    return false;
  }
}

export function needsRehash(storedHash) {
  const stored = String(storedHash || "");
  if (!stored.startsWith("$argon2id$v=19$")) return true;
  try {
    const parts = stored.split("$");
    const saltPart = parts[4] || "";
    const hashPart = parts[5] || "";
    const salt = Buffer.from(saltPart, "base64");
    const digest = Buffer.from(hashPart, "base64");
    return salt.length < 16 || digest.length !== ARGON2_OPTIONS.hashLength || argon2.needsRehash(stored, ARGON2_OPTIONS);
  } catch {
    return true;
  }
}
