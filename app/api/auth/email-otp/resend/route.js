import {
  EMAIL_OTP_CHALLENGE_COOKIE,
  readCookie,
  resendEmailOtp
} from "../../../../../src/server/email-otp.js";

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await resendEmailOtp({
      rawCookie: readCookie(req, EMAIL_OTP_CHALLENGE_COOKIE),
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
      userAgent: req.headers.get("user-agent"),
      locale: body.locale === "en" ? "en" : "ar"
    });
    if (!result.ok) return Response.json({ ok: false, reason: result.reason }, { status: result.status });
    return Response.json(result);
  } catch {
    return Response.json({ ok: false, reason: "email_delivery_failed" }, { status: 503 });
  }
}
