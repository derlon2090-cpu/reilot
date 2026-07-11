import { databaseHealth } from "../../../src/server/db.js";
import { evolutionHealth } from "../../../src/server/evolution-client.js";
import { safeErrorMessage } from "../../../src/server/security.js";

export async function GET() {
  const checks = {
    database: { ok: false },
    resend: {
      configured: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL),
      fromConfigured: Boolean(process.env.RESEND_FROM_EMAIL)
    },
    evolution: { configured: Boolean(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY), ok: false }
  };
  try {
    checks.database = await databaseHealth();
  } catch (error) {
    checks.database = { ok: false, error: safeErrorMessage(error) };
  }
  if (checks.evolution.configured) {
    try {
      checks.evolution = { configured: true, ...(await evolutionHealth()) };
    } catch (error) {
      checks.evolution = { configured: true, ok: false, error: safeErrorMessage(error) };
    }
  }
  const ok = checks.database.ok && (!checks.evolution.configured || checks.evolution.ok);
  return Response.json({
    ok,
    service: "renewpilot-ai",
    database: checks.database.ok ? "connected" : "disconnected",
    evolution: checks.evolution.ok ? "connected" : checks.evolution.configured ? "unavailable" : "not_configured",
    checks,
    timestamp: new Date().toISOString()
  }, { status: ok ? 200 : 503 });
}
