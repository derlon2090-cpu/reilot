import { databaseHealth } from "../../../src/server/db.js";
import { safeErrorMessage } from "../../../src/server/security.js";

export async function GET() {
  const checks = {
    database: { ok: false },
    resend: {
      configured: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL),
      fromConfigured: Boolean(process.env.RESEND_FROM_EMAIL)
    },
    evolution: { configured: Boolean(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY) }
  };
  try {
    checks.database = await databaseHealth();
  } catch (error) {
    checks.database = { ok: false, error: safeErrorMessage(error) };
  }
  const ok = checks.database.ok;
  return Response.json({ ok, service: "renewpilot-ai", checks, timestamp: new Date().toISOString() }, { status: ok ? 200 : 503 });
}
