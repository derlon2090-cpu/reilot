import { registerAccount } from "../../../../src/server/auth-actions.js";
import { isValidEmail, normalizeEmail, safeErrorMessage } from "../../../../src/server/security.js";
import { sessionCookie } from "../../../../src/server/session.js";

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
    console.error("register failed", safeErrorMessage(error));
    return Response.json({ ok: false, reason: "server_error" }, { status: 500 });
  }
}
