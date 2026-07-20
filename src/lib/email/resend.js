import { Resend } from "resend";

const CONSUMER_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "yahoo.com"
]);

export const RENVIX_FROM_EMAIL = "Renvix <noreply@notify.renvix.app>";
export const RENVIX_REPLY_TO_EMAIL = "support@renvix.app";

function extractAddress(value) {
  const match = String(value || "").match(/<([^>]+)>/);
  return (match?.[1] || value || "").trim().toLowerCase();
}

export function getEmailConfig() {
  const provider = (process.env.EMAIL_PROVIDER || "resend").trim().toLowerCase();
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = RENVIX_FROM_EMAIL;
  const supportEmail = RENVIX_REPLY_TO_EMAIL;

  if (provider !== "resend") throw new Error("EMAIL_PROVIDER must be resend");
  if (!apiKey) throw new Error("RESEND_API_KEY is missing");
  const senderAddress = extractAddress(from);
  const senderDomain = senderAddress.split("@")[1];
  if (!senderDomain || CONSUMER_EMAIL_DOMAINS.has(senderDomain)) {
    throw new Error("RESEND_FROM_EMAIL must use a verified sending domain");
  }

  return { apiKey, from, supportEmail };
}

export function createResendClient() {
  return new Resend(getEmailConfig().apiKey);
}
