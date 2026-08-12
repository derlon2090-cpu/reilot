import { resetPassword } from "../../../../src/server/password-reset.js";
import { normalizeEmail, safeErrorMessage } from "../../../../src/server/security.js";
import { TURNSTILE_ACTIONS, turnstileFailureResponse, verifyTurnstileToken } from "../../../../src/server/turnstile.js";

export async function POST(req) {
  try {
    const body = await req.json();
    const turnstile = await verifyTurnstileToken({ token: body.turnstileToken, expectedAction: TURNSTILE_ACTIONS.resetPassword, request: req });
    if (!turnstile.ok) return turnstileFailureResponse(turnstile);
    const result = await resetPassword({ email: normalizeEmail(body.email), code: String(body.code || ""), password: body.password });
    return result.ok ? Response.json({ ok: true }) : Response.json({ ok: false, reason: result.reason }, { status: result.status });
  } catch (error) {
    console.error("reset-password failed", safeErrorMessage(error));
    return Response.json({ ok: false, reason: "server_error" }, { status: 500 });
  }
}
