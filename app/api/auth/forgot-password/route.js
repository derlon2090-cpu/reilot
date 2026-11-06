import { mutationOriginResponse } from "../../../../src/shared/request-origin.js";
import { requestPasswordReset } from "../../../../src/server/password-reset.js";
import { isValidEmail, normalizeEmail, safeErrorMessage } from "../../../../src/server/security.js";
import { TURNSTILE_ACTIONS, turnstileFailureResponse, verifyTurnstileToken } from "../../../../src/server/turnstile.js";

export async function POST(req) {
  const originDenied = mutationOriginResponse(req);
  if (originDenied) return originDenied;
  let locale = "ar";
  try {
    const body = await req.json();
    const turnstile = await verifyTurnstileToken({ token: body.turnstileToken, expectedAction: TURNSTILE_ACTIONS.forgotPassword, request: req });
    if (!turnstile.ok) return turnstileFailureResponse(turnstile);
    const email = normalizeEmail(body.email);
    locale = body.locale === "en" ? "en" : "ar";
    if (!email) return Response.json({ ok: false, message: locale === "en" ? "Please enter your email address." : "يرجى إدخال البريد الإلكتروني." }, { status: 400 });
    if (!isValidEmail(email)) return Response.json({ ok: false, message: locale === "en" ? "Please enter a valid email address." : "صيغة البريد الإلكتروني غير صحيحة." }, { status: 400 });
    const result = await requestPasswordReset({ email, locale });
    return Response.json({ ok: result.ok, reason: result.reason, message: result.message }, { status: result.status });
  } catch (error) {
    console.error("forgot-password failed", safeErrorMessage(error));
    const deliveryUnavailable = ["EMAIL_CONFIGURATION_ERROR", "EMAIL_DELIVERY_UNAVAILABLE", "EMAIL_PROVIDER_ERROR"].includes(error?.code);
    return Response.json({
      ok: false,
      reason: deliveryUnavailable ? "email_delivery_unavailable" : "reset_unavailable",
      message: locale === "en"
        ? (deliveryUnavailable ? "We couldn't send the reset code right now. Please try again later or contact support." : "We couldn't process your request right now. Please try again shortly.")
        : (deliveryUnavailable ? "تعذر إرسال رمز الاستعادة الآن. حاول لاحقًا، وإذا استمرت المشكلة تواصل مع الدعم." : "تعذر تنفيذ الطلب الآن. حاول مرة أخرى بعد قليل.")
    }, { status: 500 });
  }
}
