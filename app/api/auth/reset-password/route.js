import { resetPassword } from "../../../../src/server/password-reset.js";
import { normalizeEmail, safeErrorMessage } from "../../../../src/server/security.js";

export async function POST(req) {
  try {
    const body = await req.json();
    const result = await resetPassword({ email: normalizeEmail(body.email), code: String(body.code || ""), password: body.password });
    return result.ok ? Response.json({ ok: true }) : Response.json({ ok: false, reason: result.reason }, { status: result.status });
  } catch (error) {
    console.error("reset-password failed", safeErrorMessage(error));
    return Response.json({ ok: false, reason: "server_error" }, { status: 500 });
  }
}
