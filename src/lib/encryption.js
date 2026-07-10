import crypto from "node:crypto";

function normalizeKey(encryptionKey) {
  if (!encryptionKey) {
    throw new Error("ENCRYPTION_KEY is required");
  }

  return crypto.createHash("sha256").update(encryptionKey).digest();
}

export function encryptSecret(plainText, encryptionKey) {
  const iv = crypto.randomBytes(12);
  const key = normalizeKey(encryptionKey);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plainText), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptSecret(payload, encryptionKey) {
  const [, ivRaw, tagRaw, encryptedRaw] = String(payload).split(":");
  if (!ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error("Invalid encrypted payload");
  }

  const decipher = crypto.createDecipheriv("aes-256-gcm", normalizeKey(encryptionKey), Buffer.from(ivRaw, "base64"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64")),
    decipher.final()
  ]).toString("utf8");
}

export function redactSecrets(value) {
  const secretKeys = new Set([
    "token",
    "channel_token",
    "channelToken",
    "channel_token_encrypted",
    "WHAPI_PARTNER_API_KEY",
    "DATABASE_URL",
    "ENCRYPTION_KEY"
  ]);

  if (Array.isArray(value)) return value.map(redactSecrets);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      secretKeys.has(key) ? "[REDACTED]" : redactSecrets(entry)
    ])
  );
}
