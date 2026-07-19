export const OPTIONAL_EMAIL_ERROR = "يرجى إدخال بريد إلكتروني صحيح أو ترك الحقل فارغًا.";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeOptionalEmail(value) {
  const email = String(value ?? "").trim().toLowerCase();
  return email || null;
}

export function validateOptionalEmail(value) {
  const email = normalizeOptionalEmail(value);
  return email && !EMAIL_PATTERN.test(email)
    ? { ok: false, email: null, value: null, reason: "invalid_email", message: OPTIONAL_EMAIL_ERROR }
    : { ok: true, email, value: email };
}

export function hasCustomerIdentity({ name, phone }) {
  return String(name || "").trim().length >= 2 || Boolean(String(phone || "").trim());
}
