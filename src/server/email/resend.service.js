import { Resend } from "resend";

function config() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey) throw new Error("RESEND_API_KEY is missing");
  if (!from) throw new Error("RESEND_FROM_EMAIL is missing");
  if (/@(?:gmail|hotmail|outlook|yahoo)\./i.test(from)) {
    throw new Error("RESEND_FROM_EMAIL must use a verified sending domain");
  }
  return { apiKey, from };
}
export async function sendPasswordResetCodeEmail({ to, code, expiresInMinutes = 10, locale = "ar" }) {
  const { apiKey, from } = config();
  const resend = new Resend(apiKey);
  const english = locale === "en";
  const subject = english ? "Password reset code - RenewPilot AI" : "رمز استعادة كلمة المرور - RenewPilot AI";
  const title = english ? "Reset your password" : "استعادة كلمة المرور";
  const intro = english
    ? "We received a password reset request for your RenewPilot AI account."
    : "تلقينا طلبًا لاستعادة كلمة المرور لحسابك في RenewPilot AI.";
  const instruction = english ? "Use this verification code to continue:" : "استخدم رمز التحقق التالي لإكمال العملية:";
  const expiry = english
    ? `This code is valid for ${expiresInMinutes} minutes.`
    : `هذا الرمز صالح لمدة ${expiresInMinutes} دقائق فقط.`;
  const ignore = english
    ? "If you did not request a password reset, you can ignore this email."
    : "إذا لم تطلب استعادة كلمة المرور، يمكنك تجاهل هذه الرسالة.";
  const direction = english ? "ltr" : "rtl";
  const html = `<div dir="${direction}" style="font-family:Arial,sans-serif;background:#f8fafc;padding:32px"><div style="max-width:560px;margin:auto;background:#fff;border-radius:12px;padding:28px;border:1px solid #e2e8f0"><h2 style="margin:0 0 12px;color:#0f172a">${title}</h2><p style="color:#334155;line-height:1.8">${intro}</p><p style="color:#334155;line-height:1.8">${instruction}</p><div style="font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;color:#0797a5;background:#ecfeff;border:1px dashed #67e8f9;padding:18px;border-radius:10px;margin:24px 0">${code}</div><p style="color:#64748b;line-height:1.8">${expiry}</p><p style="color:#64748b;line-height:1.8">${ignore}</p></div></div>`;
  const text = english
    ? `Your RenewPilot AI password reset code is ${code}. It expires in ${expiresInMinutes} minutes.`
    : `رمز استعادة كلمة المرور الخاص بك هو: ${code}. الرمز صالح لمدة ${expiresInMinutes} دقائق.`;
  const result = await resend.emails.send({ from, to, subject, html, text });
  if (result.error) throw new Error(result.error.message || "Failed to send password reset email");
  return result.data;
}

export async function sendTestEmail({ to, locale = "ar" }) {
  const { apiKey, from } = config();
  const resend = new Resend(apiKey);
  const subject = locale === "en" ? "RenewPilot AI email test" : "اختبار بريد RenewPilot AI";
  const text = locale === "en" ? "Resend is configured correctly." : "تم ربط Resend بنجاح.";
  const result = await resend.emails.send({ from, to, subject, text, html: `<p>${text}</p>` });
  if (result.error) throw new Error(result.error.message || "Failed to send test email");
  return result.data;
}
