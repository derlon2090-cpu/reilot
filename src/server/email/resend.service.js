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

function safeEmailThemeColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value) : "#0B3F3B";
}

function designedEmailBody({ design, safeText, themeColor }) {
  const theme = safeEmailThemeColor(themeColor);
  const styles = {
    modern: `padding:26px;border-radius:20px;background:#f3f8f7;border-top:6px solid ${theme};color:#062b28;line-height:1.9;box-shadow:0 14px 32px rgba(6,43,40,.08)`,
    minimal: `padding:12px 0;border-bottom:2px solid ${theme};color:#182b29;line-height:2`,
    premium: `padding:28px;border:1px solid ${theme};border-radius:20px;background:#071f1d;color:#f8fffe;line-height:1.9`,
    editorial: `padding:26px 28px;border-right:5px solid ${theme};border-radius:2px;background:#fffdf8;color:#292524;line-height:2;font-family:Georgia,'Times New Roman',serif`,
    commerce: `padding:26px;border:1px solid ${theme};border-radius:14px;background:#f8fbff;color:#0f172a;line-height:1.9`,
    aurora: `padding:28px;border:1px solid ${theme};border-radius:24px;background:linear-gradient(145deg,#ecfeff,#ffffff 48%,#fdf2f8);color:#172554;line-height:1.9`,
    executive: `padding:28px;border-top:7px solid #0f172a;border-bottom:2px solid ${theme};border-radius:4px;background:#ffffff;color:#0f172a;line-height:1.9`
  };
  const style = styles[design] || `padding:22px;border:1px solid ${theme};border-radius:15px;color:#062b28;line-height:1.9`;
  return `<div style="${style}">${safeText}</div>`;
}

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
  const designedBody = designedEmailBody({
    design,
    safeText,
    themeColor: templateSnapshot?.emailThemeColor
  });
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
