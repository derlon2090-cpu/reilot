import crypto from "node:crypto";
import { parsePhoneNumberFromString } from "libphonenumber-js";

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}
export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

export function normalizeAccountPhone(value, defaultCountry = "SA") {
  let candidate = String(value || "")
    .trim()
    .replace(/[\u0660-\u0669]/g, (digit) => String(digit.codePointAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (digit) => String(digit.codePointAt(0) - 0x06F0));
  candidate = candidate.replace(/[^\d+]/g, "");
  if (candidate.startsWith("00")) candidate = `+${candidate.slice(2)}`;
  if (/^9665\d{8}$/.test(candidate)) candidate = `+${candidate}`;
  const parsed = parsePhoneNumberFromString(candidate, defaultCountry);
  return parsed?.isValid() ? parsed.number : "";
}

export const COMMERCE_PLATFORMS = Object.freeze(["zid", "salla", "shopify", "wordpress"]);

export function normalizeCommercePlatform(value) {
  const platform = String(value || "").trim().toLowerCase();
  return COMMERCE_PLATFORMS.includes(platform) ? platform : "";
}

export function isStrongPassword(value) {
  return /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(String(value || ""));
}

export function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function safeErrorMessage(error) {
  const message = error instanceof Error ? error.message : "Unknown error";
  return message
    .replace(/re_[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[database-redacted]")
    .slice(0, 500);
}

export function safeErrorStack(error) {
  const stack = error instanceof Error ? String(error.stack || error.message) : "Unknown error";
  return stack
    .replace(/re_[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[database-redacted]")
    .replace(/(password|secret|token|cookie|authorization)=?[^\s,;]+/gi, "$1=[redacted]")
    .slice(0, 4000);
}
