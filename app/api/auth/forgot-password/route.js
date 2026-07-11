import { requestPasswordReset } from "../../../../src/server/password-reset.js";
import { isValidEmail, normalizeEmail, safeErrorMessage } from "../../../../src/server/security.js";

export async function POST(req) {
  try {
    const body = await req.json();
    const email = normalizeEmail(body.email);
    const locale = body.locale === "en" ? "en" : "ar";
    if (!email) return Response.json({ ok: false, message: locale === "en" ? "Please enter your email address." : "يرجى إدخال البريد الإلكتروني." }, { status: 400 });
    if (!isValidEmail(email)) return Response.json({ ok: false, message: locale === "en" ? "Please enter a valid email address." : "صيغة البريد الإلكتروني غير صحيحة." }, { status: 400 });
    const result = await requestPasswordReset({ email, locale });
    return Response.json({ ok: result.ok, message: result.message }, { status: result.status });
  } catch (error) {
    console.error("forgot-password failed", safeErrorMessage(error));
    return Response.json({ ok: false, message: "تعذر إرسال كود التحقق، تأكد من إعدادات البريد وحاول مرة أخرى." }, { status: 500 });
  }
}
