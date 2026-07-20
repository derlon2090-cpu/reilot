import crypto from "node:crypto";
import QRCode from "qrcode";
import { decryptSecret, encryptSecret } from "../lib/encryption.js";
import { randomToken, sha256 } from "./security.js";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buffer) {
  let bits = "";
  for (const byte of buffer) bits += byte.toString(2).padStart(8, "0");
  let output = "";
  for (let index = 0; index < bits.length; index += 5) {
    output += ALPHABET[Number.parseInt(bits.slice(index, index + 5).padEnd(5, "0"), 2)];
  }
  return output;
}

function base32Decode(value) {
  const bits = String(value).replace(/=+$/g, "").toUpperCase().split("")
    .map((char) => ALPHABET.indexOf(char).toString(2).padStart(5, "0")).join("");
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  return Buffer.from(bytes);
}

function hotp(secret, counter) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac("sha1", base32Decode(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

export function createMfaSecret() {
  return base32Encode(crypto.randomBytes(20));
}

export function verifyTotp(secret, code, now = Date.now()) {
  if (!/^\d{6}$/.test(String(code || ""))) return false;
  const counter = Math.floor(now / 30_000);
  return [-1, 0, 1].some((offset) => hotp(secret, counter + offset) === String(code));
}

export function encryptMfaSecret(secret) {
  const key = process.env.MFA_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;
  return encryptSecret(secret, key);
}

export function decryptMfaSecret(value) {
  const key = process.env.MFA_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;
  return decryptSecret(value, key);
}

export async function mfaQrCode({ email, secret }) {
  const uri = `otpauth://totp/${encodeURIComponent(`Renvix:${email}`)}?secret=${secret}&issuer=Renvix&algorithm=SHA1&digits=6&period=30`;
  return QRCode.toDataURL(uri, { errorCorrectionLevel: "M", width: 260, margin: 2 });
}

export function createRecoveryCodes(count = 8) {
  const codes = Array.from({ length: count }, () => `${randomToken(4).slice(0, 5).toUpperCase()}-${randomToken(4).slice(0, 5).toUpperCase()}`);
  return { codes, hashes: codes.map((code) => sha256(code)) };
}

