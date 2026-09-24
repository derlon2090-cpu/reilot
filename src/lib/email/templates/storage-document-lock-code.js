import { baseEmail, escapeEmailHtml } from "./base-email.js";

export function storageDocumentLockCodeEmail({ code, documentTitle, expiresInMinutes = 10, locale = "ar" }) {
  const english = locale === "en";
  const safeCode = escapeEmailHtml(code);
  const safeTitle = escapeEmailHtml(documentTitle || (english ? "Protected document" : "ملف محمي"));
  const title = english ? "Reset a document password" : "إعادة تعيين كلمة مرور ملف";
  const html = baseEmail({
    title,
    preview: english ? "Your protected document verification code" : "رمز التحقق للملف المحمي",
    locale,
    children: `
      <p style="margin:0 0 12px">${english ? "A password reset was requested for this protected document:" : "طُلبت إعادة تعيين كلمة مرور الملف المحمي التالي:"}</p>
      <p style="margin:0 0 18px;font-weight:800">${safeTitle}</p>
      <div style="margin:24px 0;padding:18px;border:1px dashed #0B3F3B;border-radius:12px;background:#F3F8F7;color:#062B28;text-align:center;font-size:32px;font-weight:800;letter-spacing:8px;direction:ltr">${safeCode}</div>
      <p style="margin:0 0 10px;color:#64748b">${english ? `This code expires in ${expiresInMinutes} minutes and can be used once.` : `ينتهي هذا الرمز خلال ${expiresInMinutes} دقائق ويُستخدم مرة واحدة.`}</p>
      <p style="margin:0;color:#64748b">${english ? "If you did not request this change, ignore this email and do not share the code." : "إذا لم تطلب هذا التغيير، تجاهل الرسالة ولا تشارك الرمز مع أي شخص."}</p>
    `
  });
  return {
    subject: english ? "Protected document verification code - Renvix" : "رمز التحقق للملف المحمي - Renvix",
    html,
    text: english
      ? `The verification code for ${documentTitle || "your protected document"} is ${code}. It expires in ${expiresInMinutes} minutes.`
      : `رمز التحقق للملف المحمي ${documentTitle || ""} هو ${code}. صلاحيته ${expiresInMinutes} دقائق.`
  };
}
