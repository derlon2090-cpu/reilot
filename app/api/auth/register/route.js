import { mutationOriginResponse } from "../../../../src/shared/request-origin.js";
import { registerAccount } from "../../../../src/server/auth-actions.js";
import { isValidEmail, normalizeAccountPhone, normalizeCommercePlatform, normalizeEmail, safeErrorMessage } from "../../../../src/server/security.js";
import { sessionCookie } from "../../../../src/server/session.js";
import { challengeCookie } from "../../../../src/server/email-otp-v2.js";
import { TURNSTILE_ACTIONS, turnstileFailureResponse, verifyTurnstileToken } from "../../../../src/server/turnstile.js";

function registrationFailure(error) {
  if (["EMAIL_DELIVERY_UNAVAILABLE", "EMAIL_PROVIDER_ERROR", "EMAIL_CONFIGURATION_ERROR"].includes(error?.code)) {
    return { reason: "email_otp_unavailable", status: 503 };
  }
  if (error?.code === "23505") {
    const constraint = String(error?.constraint || "");
    return { reason: constraint.includes("phone") ? "phone_exists" : "email_exists", status: 409 };
  }
  if (["42P01", "42703"].includes(error?.code)) return { reason: "database_schema_missing", status: 503 };
  if (["08000", "08001", "08003", "08004", "08006", "08007", "08P01", "28P01", "3D000"].includes(error?.code)) {
    return { reason: "database_unavailable", status: 503 };
  }
  return { reason: "server_error", status: 500 };
}

export async function POST(req) {
  const originDenied = mutationOriginResponse(req);
  if (originDenied) return originDenied;
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json({ ok: false, reason: "invalid_request" }, { status: 400 });
    }
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const companyName = typeof body.companyName === "string" ? body.companyName.trim() : "";
    const rawEmail = typeof body.email === "string" ? body.email : "";
    const rawPhone = typeof body.phone === "string" ? body.phone : "";
    const password = typeof body.password === "string" ? body.password : "";
    const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword : "";
    if (name.length < 3 || name.length > 100) {
      return Response.json({ ok: false, reason: "invalid_name" }, { status: 400 });
    }
    if (companyName.length > 160 || Buffer.byteLength(password, "utf8") > 1024) {
      return Response.json({ ok: false, reason: "invalid_request" }, { status: 400 });
    }
    if (rawEmail.length > 254) return Response.json({ ok: false, reason: "invalid_email" }, { status: 400 });
    if (rawPhone.length > 32) return Response.json({ ok: false, reason: "invalid_phone" }, { status: 400 });
    if (password !== confirmPassword) {
      return Response.json({ ok: false, reason: "password_mismatch" }, { status: 400 });
    }
    if (!(body.acceptPolicies === true || body.acceptPolicies === "on")) {
      return Response.json({ ok: false, reason: "policy_required" }, { status: 400 });
    }
    const turnstile = await verifyTurnstileToken({ token: body.turnstileToken, expectedAction: TURNSTILE_ACTIONS.register, request: req });
    if (!turnstile.ok) return turnstileFailureResponse(turnstile);
    const email = normalizeEmail(rawEmail);
    if (!isValidEmail(email)) return Response.json({ ok: false, reason: "invalid_email" }, { status: 400 });
    const phone = normalizeAccountPhone(rawPhone);
    if (!phone) return Response.json({ ok: false, reason: "invalid_phone" }, { status: 400 });
    const commercePlatform = normalizeCommercePlatform(body.commercePlatform);
    if (!commercePlatform) return Response.json({ ok: false, reason: "invalid_commerce_platform" }, { status: 400 });
    const result = await registerAccount({
      name,
      companyName,
      email,
      phone,
      commercePlatform,
      password,
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
      userAgent: req.headers.get("user-agent")
    });
    if (!result.ok) return Response.json({ ok: false, reason: result.reason }, { status: result.status });
    if (result.requiresEmailOtp) {
      return Response.json({
        ok: true,
        requiresEmailOtp: true,
        maskedEmail: result.challenge.maskedEmail,
        expiresAt: result.challenge.expiresAt,
        resendAt: result.challenge.resendAt
      }, {
        status: 202,
        headers: { "Set-Cookie": challengeCookie(result.challenge.challengeCookie) }
      });
    }
    return Response.json({ ok: true, user: result.user }, { status: 201, headers: { "Set-Cookie": sessionCookie(result.session.token) } });
  } catch (error) {
    const failure = registrationFailure(error);
    console.error("register failed", {
      reason: failure.reason,
      code: error?.code || "unknown",
      table: error?.table || undefined,
      constraint: error?.constraint || undefined,
      message: safeErrorMessage(error)
    });
    return Response.json({ ok: false, reason: failure.reason }, { status: failure.status });
  }
}
