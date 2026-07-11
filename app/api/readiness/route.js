import { query } from "../../../src/server/db.js";
import { sendTestEmail } from "../../../src/server/email/resend.service.js";
import { evolutionHealth } from "../../../src/server/evolution-client.js";
import { recordOperationalIssue } from "../../../src/server/operations.js";
import { requireSession } from "../../../src/server/session.js";
import { safeErrorMessage } from "../../../src/server/security.js";

const requiredEnvironment = [
  "DATABASE_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL", "JWT_SECRET", "CRON_SECRET", "ENCRYPTION_KEY",
  "EVOLUTION_API_URL", "EVOLUTION_API_KEY", "EVOLUTION_WEBHOOK_SECRET"
];

async function buildReport(req, testEmail) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth;
  const tenantId = auth.session.tenantId;
  const statuses = {};

  try {
    const startedAt = Date.now();
    await query("SELECT 1");
    statuses.database = { ok: true, label: "Connected", latencyMs: Date.now() - startedAt };
  } catch (error) {
    statuses.database = { ok: false, label: "Unavailable", error: safeErrorMessage(error) };
  }

  try {
    const health = await evolutionHealth();
    statuses.evolution = { ok: true, label: "Connected", ...health };
  } catch (error) {
    statuses.evolution = { ok: false, label: "Unavailable", error: safeErrorMessage(error) };
  }

  const channelResult = await query(
    `SELECT id, status, phone_number AS "phoneNumber", risk_score AS "riskScore", last_health_check_at AS "lastHealthCheckAt"
       FROM whatsapp_channels WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [tenantId]
  );
  const channel = channelResult.rows[0] || null;
  statuses.whatsapp = { ok: channel?.status === "connected", label: channel?.status || "not_connected", channel };

  const resendConfigured = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
  statuses.resend = { ok: resendConfigured, label: resendConfigured ? "Configured" : "Not configured", tested: false };
  if (resendConfigured && testEmail) {
    try {
      const sent = await sendTestEmail({ to: auth.session.email, locale: "en" });
      statuses.resend = { ok: true, label: "Delivered to provider", tested: true, providerMessageId: sent?.id || null };
    } catch (error) {
      statuses.resend = { ok: false, label: "Test failed", tested: true, error: safeErrorMessage(error) };
      await recordOperationalIssue({ tenantId, category: "resend", source: "readiness", message: safeErrorMessage(error), suggestedSolution: "Verify the Resend API key and verified sender domain." }).catch(() => null);
    }
  }

  const cronResult = await query(
    `SELECT created_at AS "lastRunAt", title FROM activity_logs
      WHERE tenant_id = $1 AND type = 'cron.executed' ORDER BY created_at DESC LIMIT 1`,
    [tenantId]
  );
  const cronSecretValid = String(process.env.CRON_SECRET || "").length >= 32;
  statuses.cron = { ok: cronSecretValid && Boolean(cronResult.rows[0]), label: cronSecretValid ? (cronResult.rows[0] ? "Running" : "No run recorded") : "Invalid secret", lastRun: cronResult.rows[0] || null };

  const forwardedProto = req.headers.get("x-forwarded-proto") || new URL(req.url).protocol.replace(":", "");
  const publicUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL || "";
  statuses.https = { ok: forwardedProto === "https" && publicUrl.startsWith("https://"), label: forwardedProto === "https" ? "HTTPS" : "HTTP only" };

  const missing = requiredEnvironment.filter((name) => !process.env[name]);
  statuses.environment = { ok: missing.length === 0, label: missing.length ? "Missing variables" : "Complete", missing };

  const eventResult = await query(
    `SELECT type, title, created_at AS "createdAt" FROM activity_logs
      WHERE tenant_id = $1 AND type LIKE 'evolution.webhook.%' ORDER BY created_at DESC LIMIT 1`,
    [tenantId]
  );
  const backupResult = await query(
    `SELECT title, created_at AS "createdAt" FROM activity_logs
      WHERE tenant_id = $1 AND type = 'backup.completed' ORDER BY created_at DESC LIMIT 1`,
    [tenantId]
  );
  const lastWebhook = eventResult.rows[0] || null;
  const lastBackup = backupResult.rows[0] || null;
  const ready = Object.values(statuses).every((item) => item.ok) && Boolean(lastWebhook && lastBackup);
  return { ok: true, report: { statuses, lastWebhook, lastBackup, result: ready ? "ready" : "not_ready", checkedAt: new Date().toISOString() } };
}

export async function GET(req) {
  const result = await buildReport(req, false);
  return result.ok ? Response.json(result) : result.response;
}

export async function POST(req) {
  const result = await buildReport(req, true);
  return result.ok ? Response.json(result) : result.response;
}
