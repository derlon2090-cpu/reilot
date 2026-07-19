import { baseEmail, escapeEmailHtml } from "./base-email.js";

export function forgotPasswordCodeEmail({ code, expiresInMinutes = 10, locale = "ar" }) {
  const english = locale === "en";
  const safeCode = escapeEmailHtml(code);
  const title = english ? "Reset your password" : "استعادة كلمة المرور";
  const intro = english
    ? "We received a password reset request for your Renvix account."
    : "تلقينا طلبًا لاستعادة كلمة المرور لحسابك في Renvix.";
  const expiry = english
    ? `This code is valid for ${expiresInMinutes} minutes.`
    : `هذا الرمز صالح لمدة ${expiresInMinutes} دقائق فقط.`;
  const ignore = english
    ? "If you did not make this request, ignore this email and do not share the code."
    : "إذا لم تطلب استعادة كلمة المرور، تجاهل الرسالة ولا تشارك الرمز مع أي شخص.";

  const html = baseEmail({
    title,
    preview: english ? "Your Renvix password reset code" : "رمز استعادة كلمة المرور في Renvix",
    locale,
    children: `
      <p style="margin:0 0 16px">${intro}</p>
      <p style="margin:0 0 16px">${english ? "Use this verification code to continue:" : "استخدم رمز التحقق التالي لإكمال العملية:"}</p>
      <div style="margin:24px 0;padding:18px;border:1px dashed #22c7d6;border-radius:12px;background:#ecfeff;color:#087f97;text-align:center;font-size:32px;font-weight:800;letter-spacing:8px;direction:ltr">${safeCode}</div>
      <p style="margin:0 0 10px;color:#64748b">${expiry}</p>
      <p style="margin:0;color:#64748b">${ignore}</p>
    `
  });
  const text = english
    ? `Your Renvix password reset code is ${code}. It expires in ${expiresInMinutes} minutes.`
    : `رمز استعادة كلمة المرور في Renvix هو ${code}. صلاحيته ${expiresInMinutes} دقائق.`;

  return {
    subject: english ? "Password reset code - Renvix" : "رمز استعادة كلمة المرور - Renvix",
    html,
    text
  };
}
