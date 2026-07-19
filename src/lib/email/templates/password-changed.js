import { baseEmail } from "./base-email.js";

export function passwordChangedEmail({ locale = "ar" } = {}) {
  const english = locale === "en";
  const title = english ? "Your password was changed" : "تم تغيير كلمة المرور";
  const html = baseEmail({
    title,
    preview: english ? "Renvix account security notice" : "تنبيه أمني لحسابك في Renvix",
    locale,
    children: `
      <p style="margin:0 0 14px">${english
        ? "The password for your Renvix account was changed successfully."
        : "تم تغيير كلمة المرور لحسابك في Renvix بنجاح."}</p>
      <p style="margin:0;color:#64748b">${english
        ? "If you did not make this change, contact support immediately and secure your account."
        : "إذا لم تنفذ هذا التغيير، تواصل مع الدعم فورًا وقم بتأمين حسابك."}</p>
    `
  });
  const text = english
    ? "Your Renvix password was changed. If this was not you, contact support immediately."
    : "تم تغيير كلمة مرور حسابك في Renvix. إذا لم تكن أنت، تواصل مع الدعم فورًا.";

  return {
    subject: english ? "Password changed - Renvix" : "تم تغيير كلمة المرور - Renvix",
    html,
    text
  };
}
