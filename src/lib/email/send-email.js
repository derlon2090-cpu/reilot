import { createResendClient, getEmailConfig } from "./resend.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function sendEmail({ to, subject, html, text }) {
  const recipient = String(to || "").trim();
  if (!EMAIL_PATTERN.test(recipient)) throw new Error("A valid recipient email is required");
  if (!String(subject || "").trim()) throw new Error("Email subject is required");
  if (!String(html || "").trim() || !String(text || "").trim()) {
    throw new Error("Email HTML and text bodies are required");
  }

  const { from, supportEmail } = getEmailConfig();
  const resend = createResendClient();
  const result = await resend.emails.send({
    from,
    to: recipient,
    subject: String(subject).trim(),
    html,
    text,
    replyTo: supportEmail
  });

  if (result.error) throw new Error(result.error.message || "Email delivery failed");
  return result.data;
}
