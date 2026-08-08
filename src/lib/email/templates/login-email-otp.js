import { baseEmail, escapeEmailHtml } from "./base-email.js";

export function loginEmailOtp({ code, expiresInMinutes = 5, locale = "ar", name = "" }) {
  const english = locale === "en";
  const safeCode = escapeEmailHtml(code);
  const safeName = escapeEmailHtml(String(name || "").trim());
  const subject = english ? "Your Renvix verification code" : "رمز التحقق لتسجيل الدخول إلى Renvix";
  const text = english
    ? `${safeName ? `Hello ${name}, ` : ""}Your Renvix verification code is ${code}. It expires in ${expiresInMinutes} minutes and can be used once. Do not share this code.`
    : `${safeName ? `مرحبًا ${name}، ` : ""}رمز التحقق لتسجيل الدخول إلى Renvix هو ${code}. تنتهي صلاحيته خلال ${expiresInMinutes} دقائق ويمكن استخدامه مرة واحدة فقط. لا تشارك هذا الرمز مع أي شخص.`;
  const html = baseEmail({
    title: subject,
    preview: text,
    locale,
    children: `
      ${safeName ? `<p style="margin:0 0 12px;font-weight:700">${english ? `Hello ${safeName},` : `مرحبًا ${safeName}،`}</p>` : ""}
      <p style="margin:0 0 18px">${english ? "Use this one-time code to complete your secure sign-in:" : "استخدم رمز الاستخدام الواحد التالي لإكمال تسجيل الدخول الآمن:"}</p>
      <div dir="ltr" style="margin:20px auto;padding:18px;text-align:center;letter-spacing:12px;font-size:34px;font-weight:800;color:#062B28;border:1px solid #E8F1F0;border-radius:12px;background:#F3F8F7">${safeCode}</div>
      <p style="margin:18px 0 0;color:#64748b">${english ? `This code expires in ${expiresInMinutes} minutes and can only be used once. If you did not request it, ignore this email and review your account security.` : `ينتهي الرمز خلال ${expiresInMinutes} دقائق ويمكن استخدامه مرة واحدة فقط. إذا لم تطلب تسجيل الدخول، تجاهل هذه الرسالة وراجع أمان حسابك.`}</p>
      <p style="margin:10px 0 0;color:#b91c1c;font-weight:700">${english ? "Never share this code with anyone." : "لا تشارك هذا الرمز مع أي شخص."}</p>
    `
  });
  return { subject, text, html };
}
