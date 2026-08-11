import crypto from "node:crypto";
import { sendEmail } from "../../lib/email/send-email.js";
import { baseEmail, escapeEmailHtml } from "../../lib/email/templates/base-email.js";
import { forgotPasswordCodeEmail } from "../../lib/email/templates/forgot-password-code.js";
import { orderInfoLinkEmail } from "../../lib/email/templates/order-info-link.js";
import { passwordChangedEmail } from "../../lib/email/templates/password-changed.js";
import { renewalReminderEmail } from "../../lib/email/templates/renewal-reminder.js";
import { loginEmailOtp } from "../../lib/email/templates/login-email-otp.js";
import { supportReplyEmail } from "../../lib/email/templates/support-reply.js";
import { inspectCustomEmailHtml, supportedEmailContentMode, supportedEmailDesign } from "../../lib/email/custom-email-html.js";

export async function sendPasswordResetCodeEmail({ to, code, expiresInMinutes = 10, locale = "ar" }) {
  return sendEmail({ to, ...forgotPasswordCodeEmail({ code, expiresInMinutes, locale }) });
}

export async function sendLoginEmailOtp({ to, code, expiresInMinutes = 5, locale = "ar", name = "" }) {
  return sendEmail({
    to,
    tags: [{ name: "purpose", value: "login_otp" }],
    idempotencyKey: `login-otp-${crypto.createHash("sha256").update(`${String(to).trim().toLowerCase()}:${code}`).digest("hex")}`,
    ...loginEmailOtp({ code, expiresInMinutes, locale, name })
  });
}

export async function sendTestEmail({ to, locale = "ar" }) {
  const english = locale === "en";
  const subject = english ? "Renvix email test" : "اختبار بريد Renvix";
  const text = english ? "Resend is configured correctly for Renvix." : "تم ربط Resend مع Renvix بنجاح.";
  const html = baseEmail({ title: subject, preview: text, locale, children: `<p style="margin:0">${text}</p>` });
  return sendEmail({ to, subject, text, html });
}

export async function sendOrderInformationEmail({ to, customerName, storeName, storeImageUrl, storeImageRadius, orderNumber, publicUrl, locale = "ar" }) {
  return sendEmail({
    to,
    ...orderInfoLinkEmail({ customerName, storeName, storeImageUrl, storeImageRadius, orderNumber, publicUrl, locale })
  });
}

export async function sendQueuedEmail({ to, subject, text, templateSnapshot = null, tags = [], brandImageUrl = "" }) {
  if (templateSnapshot?.type === "renewal_email_v1") {
    return sendEmail({
      to,
      ...renewalReminderEmail({
        ...(templateSnapshot.data || {}),
        template: templateSnapshot.template || {}
      })
    });
  }
  if (templateSnapshot?.type === "order_information_email_v1") {
    return sendEmail({
      to,
      ...orderInfoLinkEmail(templateSnapshot.data || {})
    });
  }
  const branding = templateSnapshot?.branding && typeof templateSnapshot.branding === "object"
    ? templateSnapshot.branding
    : {};
  const safeText = escapeEmailHtml(text).replace(/\n/g, "<br>");
  const design = supportedEmailDesign(templateSnapshot?.emailDesign);
  const designedBody = design === "modern"
    ? `<div style="padding:24px;border-radius:18px;background:#f3f8f7;border-top:5px solid #0b3f3b;color:#062b28;line-height:1.9">${safeText}</div>`
    : design === "minimal"
      ? `<div style="padding:8px 0;color:#062b28;line-height:1.9">${safeText}</div>`
      : design === "premium"
        ? `<div style="padding:26px;border:1px solid #315b56;border-radius:18px;background:#071f1d;color:#f8fffe;line-height:1.9">${safeText}</div>`
        : `<div style="padding:20px;border:1px solid #e8f1f0;border-radius:14px;color:#062b28;line-height:1.9">${safeText}</div>`;
  const customInspection = supportedEmailContentMode(templateSnapshot?.emailContentMode) === "html"
    ? inspectCustomEmailHtml(templateSnapshot?.emailHtmlContent)
    : null;
  return sendEmail({
    to,
    subject: subject || "إشعار من Renvix",
    text,
    tags,
    html: baseEmail({
      title: subject || "إشعار من Renvix",
      brandName: branding.brandName || "Renvix",
      brandImageUrl: branding.logoUrl || brandImageUrl,
      brandImageRadius: Number(branding.logoBorderRadius ?? 16),
      children: customInspection?.ok ? customInspection.html : designedBody
    })
  });
}

export async function sendRenewalReminderEmail({ to, ...input }) {
  return sendEmail({ to, ...renewalReminderEmail(input) });
}

export async function sendPasswordChangedEmail({ to, locale = "ar" }) {
  return sendEmail({ to, ...passwordChangedEmail({ locale }) });
}

export async function sendSupportReplyEmail({ to, requesterName, ticketNumber, ticketSubject, replyBody }) {
  return sendEmail({
    to,
    tags: [{ name: "purpose", value: "support_reply" }],
    ...supportReplyEmail({ requesterName, ticketNumber, ticketSubject, replyBody })
  });
}
