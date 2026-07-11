import { verifyResetCode } from "../../../../src/server/password-reset.js";
import { normalizeEmail } from "../../../../src/server/security.js";

export async function POST(req) {
  const body = await req.json();
  const result = await verifyResetCode({ email: normalizeEmail(body.email), code: String(body.code || "") });
  return result.ok
    ? Response.json({ ok: true })
    : Response.json({ ok: false, reason: result.reason }, { status: 400 });
}
