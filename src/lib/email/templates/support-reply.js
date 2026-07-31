import { baseEmail, escapeEmailHtml } from "./base-email.js";

export function supportReplyEmail({
  requesterName = "",
  ticketNumber,
  ticketSubject,
  replyBody
}) {
  const name = String(requesterName || "").trim() || "عميل رينفكس";
  const number = String(ticketNumber || "").trim();
  const subject = String(ticketSubject || "").trim() || "طلب الدعم";
  const reply = String(replyBody || "").trim();
  const emailSubject = `${number ? `[${number}] ` : ""}رد من فريق رينفكس: ${subject}`;
  const text = [
    `مرحبًا ${name}،`,
    "",
    "وصل رد جديد من فريق دعم رينفكس على طلبك:",
    reply,
    "",
    number ? `رقم الطلب: ${number}` : "",
    `الموضوع: ${subject}`,
    "",
    "يمكنك الرد على هذا البريد أو التواصل عبر support@renvix.app."
  ].filter(Boolean).join("\n");
  const safeReply = escapeEmailHtml(reply).replace(/\n/g, "<br>");
  const html = baseEmail({
    title: "رد جديد من فريق دعم رينفكس",
    preview: emailSubject,
    children: `
      <p style="margin:0 0 16px">مرحبًا <strong>${escapeEmailHtml(name)}</strong>،</p>
      <p style="margin:0 0 18px">وصل رد جديد على طلب الدعم الخاص بك:</p>
      <div style="padding:18px;border:1px solid #dbe7f4;border-radius:12px;background:#f8fbff;color:#17345f;line-height:1.9">${safeReply}</div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:20px;border-collapse:collapse">
        ${number ? `<tr><td style="padding:7px 0;color:#718096">رقم الطلب</td><td style="padding:7px 0;text-align:left;color:#0f2550;font-weight:700">${escapeEmailHtml(number)}</td></tr>` : ""}
        <tr><td style="padding:7px 0;color:#718096">الموضوع</td><td style="padding:7px 0;text-align:left;color:#0f2550;font-weight:700">${escapeEmailHtml(subject)}</td></tr>
      </table>
      <p style="margin:20px 0 0;color:#718096;font-size:14px">يمكنك الرد على هذا البريد أو التواصل عبر support@renvix.app.</p>
    `,
    footerText: "Renvix - فريق الدعم"
  });
  return { subject: emailSubject, text, html };
}
