import { createResendClient, resolveVerifiedEmailConfig } from "./resend.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function sendEmail({ to, subject, html, text, tags = [] }) {
  const recipient = String(to || "").trim();
  if (!EMAIL_PATTERN.test(recipient)) throw new Error("A valid recipient email is required");
  if (!String(subject || "").trim()) throw new Error("Email subject is required");
  if (!String(html || "").trim() || !String(text || "").trim()) {
    throw new Error("Email HTML and text bodies are required");
  }

  const { from, supportEmail } = await resolveVerifiedEmailConfig();
  const resend = createResendClient();
  const result = await resend.emails.send({
    from,
    to: recipient,
    subject: String(subject).trim(),
    html,
    text,
    replyTo: supportEmail,
    tags: Array.isArray(tags) ? tags.slice(0, 10) : []
  });

  if (result.error) {
    const error = new Error(result.error.message || "Email delivery failed");
    error.code = "EMAIL_DELIVERY_UNAVAILABLE";
    error.providerCode = result.error.name || result.error.statusCode || null;
    throw error;
  }
  return result.data;
}
