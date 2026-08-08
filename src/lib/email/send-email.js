import { createResendClient, resolveVerifiedEmailConfig } from "./resend.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RETRYABLE_PROVIDER_CODES = new Set([
  "application_error",
  "internal_server_error",
  "concurrent_idempotent_requests",
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT"
]);

function emailError(message, code, providerCode = null) {
  const error = new Error(message);
  error.code = code;
  error.providerCode = providerCode;
  return error;
}

function isRetryable(error) {
  const providerCode = String(error?.providerCode || error?.cause?.code || "");
  return RETRYABLE_PROVIDER_CODES.has(providerCode)
    || /fetch failed|network|socket|timeout/i.test(String(error?.message || ""));
}

function waitBeforeRetry() {
  return new Promise((resolve) => setTimeout(resolve, 250));
}

export async function sendEmail({ to, subject, html, text, tags = [], idempotencyKey = "" }) {
  const recipient = String(to || "").trim();
  if (!EMAIL_PATTERN.test(recipient)) throw emailError("A valid recipient email is required", "EMAIL_DELIVERY_UNAVAILABLE", "invalid_recipient");
  if (!String(subject || "").trim()) throw emailError("Email subject is required", "EMAIL_CONFIGURATION_ERROR");
  if (!String(html || "").trim() || !String(text || "").trim()) {
    throw emailError("Email HTML and text bodies are required", "EMAIL_CONFIGURATION_ERROR");
  }

  const { from, supportEmail } = await resolveVerifiedEmailConfig();
  const resend = createResendClient();
  const payload = {
    from,
    to: recipient,
    subject: String(subject).trim(),
    html,
    text,
    replyTo: supportEmail,
    tags: Array.isArray(tags) ? tags.slice(0, 10) : []
  };
  const requestOptions = String(idempotencyKey || "").trim()
    ? { idempotencyKey: String(idempotencyKey).trim().slice(0, 256) }
    : undefined;

  let lastError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await resend.emails.send(payload, requestOptions);
      if (!result.error) return result.data;
      lastError = emailError(
        result.error.message || "Email delivery failed",
        "EMAIL_DELIVERY_UNAVAILABLE",
        result.error.name || result.error.statusCode || null
      );
    } catch (cause) {
      if (["EMAIL_CONFIGURATION_ERROR", "EMAIL_DELIVERY_UNAVAILABLE"].includes(cause?.code)) {
        lastError = cause;
      } else {
        lastError = emailError(
          cause?.message || "Email provider request failed",
          "EMAIL_PROVIDER_ERROR",
          cause?.code || cause?.cause?.code || null
        );
        lastError.cause = cause;
      }
    }
    if (attempt === 1 || !isRetryable(lastError)) throw lastError;
    await waitBeforeRetry();
  }
  throw lastError || emailError("Email delivery failed", "EMAIL_PROVIDER_ERROR");
}
