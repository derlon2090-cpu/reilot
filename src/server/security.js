import crypto from "node:crypto";

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}
export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
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
