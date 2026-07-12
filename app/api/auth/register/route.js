import { registerAccount } from "../../../../src/server/auth-actions.js";
import { isValidEmail, normalizeEmail, safeErrorMessage } from "../../../../src/server/security.js";
import { sessionCookie } from "../../../../src/server/session.js";

function registrationFailure(error) {
  if (error?.code === "23505") return { reason: "email_exists", status: 409 };
  if (["42P01", "42703"].includes(error?.code)) return { reason: "database_schema_missing", status: 503 };
  if (["08000", "08001", "08003", "08004", "08006", "08007", "08P01", "28P01", "3D000"].includes(error?.code)) {
    return { reason: "database_unavailable", status: 503 };
  }
  return { reason: "server_error", status: 500 };
}

export async function POST(req) {
  try {
    const body = await req.json();
    const email = normalizeEmail(body.email);
    if (!isValidEmail(email)) return Response.json({ ok: false, reason: "invalid_email" }, { status: 400 });
    const result = await registerAccount({
      name: body.name,
      email,
      password: body.password,
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
      userAgent: req.headers.get("user-agent")
    });
    if (!result.ok) return Response.json({ ok: false, reason: result.reason }, { status: result.status });
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
