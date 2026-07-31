import { sendEmail } from "../../lib/email/send-email.js";
import { baseEmail, escapeEmailHtml } from "../../lib/email/templates/base-email.js";
import { forgotPasswordCodeEmail } from "../../lib/email/templates/forgot-password-code.js";
import { orderInfoLinkEmail } from "../../lib/email/templates/order-info-link.js";
import { passwordChangedEmail } from "../../lib/email/templates/password-changed.js";
import { renewalReminderEmail } from "../../lib/email/templates/renewal-reminder.js";
import { loginEmailOtp } from "../../lib/email/templates/login-email-otp.js";
import { supportReplyEmail } from "../../lib/email/templates/support-reply.js";

export async function sendPasswordResetCodeEmail({ to, code, expiresInMinutes = 10, locale = "ar" }) {
  return sendEmail({ to, ...forgotPasswordCodeEmail({ code, expiresInMinutes, locale }) });
}

export async function sendLoginEmailOtp({ to, code, expiresInMinutes = 5, locale = "ar", name = "" }) {
  return sendEmail({
    to,
    tags: [{ name: "purpose", value: "login_otp" }],
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

export async function sendOrderInformationEmail({ to, customerName, storeName, orderNumber, publicUrl, locale = "ar" }) {
  return sendEmail({
    to,
    ...orderInfoLinkEmail({ customerName, storeName, orderNumber, publicUrl, locale })
  });
}

export async function sendQueuedEmail({ to, subject, text, templateSnapshot = null, tags = [] }) {
  if (templateSnapshot?.type === "renewal_email_v1") {
    return sendEmail({
      to,
      ...renewalReminderEmail({
        ...(templateSnapshot.data || {}),
        template: templateSnapshot.template || {}
      })
    });
  }
  const safeText = escapeEmailHtml(text).replace(/\n/g, "<br>");
  return sendEmail({
    to,
    subject: subject || "إشعار من Renvix",
    text,
    tags,
    html: baseEmail({
      title: subject || "إشعار من Renvix",
      children: `<div style="color:#0f172a;line-height:1.9">${safeText}</div>`
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
