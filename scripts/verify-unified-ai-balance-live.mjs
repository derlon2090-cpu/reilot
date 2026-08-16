import crypto from "node:crypto";
import { getPool, query } from "../src/server/db.js";
import {
  getAIEntitlementSummary,
  releaseAITokenReservation,
  reserveAITokens,
  settleAITokenReservation
} from "../src/server/ai/entitlements.js";
import { createAIRun, finishAIRun } from "../src/server/ai/provider-accounting.js";
import { DeepSeekProvider, deepSeekEnvironmentStatus } from "../src/server/ai/provider.js";

const TASK_TYPES = [
  "chat",
  "email_template_code_generate",
  "email_template_code_replace",
  "campaign_copy_generate",
  "campaign_copy_regenerate"
];

function assert(condition, code) {
  if (!condition) throw Object.assign(new Error(code), { code });
}

const environment = deepSeekEnvironmentStatus();
const missing = ["DATABASE_URL", "DEEPSEEK_API_KEY"].filter((name) => !String(process.env[name] || "").trim());
if (environment.forbiddenPublicVariables.length) {
  process.stderr.write(`${JSON.stringify({ ok: false, code: "AI_PROVIDER_PUBLIC_SECRET_FORBIDDEN" })}\n`);
  process.exitCode = 1;
} else if (missing.length || process.env.UNIFIED_AI_LIVE_CONFIRM !== "renvix-synthetic-only") {
  process.stdout.write(`${JSON.stringify({
    ok: true,
    skipped: true,
    code: missing.length ? "UNIFIED_AI_LIVE_ENVIRONMENT_INCOMPLETE" : "UNIFIED_AI_LIVE_CONFIRMATION_REQUIRED",
    required: missing.length ? missing : ["UNIFIED_AI_LIVE_CONFIRM=renvix-synthetic-only"]
  })}\n`);
} else {
  const tenantId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const subscriptionId = crypto.randomUUID();
  const session = { tenantId, userId };
  const chargedByTask = {};
  try {
    const plan = await query("SELECT id FROM platform_plans WHERE slug='trial' LIMIT 1");
    assert(plan.rows[0]?.id, "UNIFIED_AI_LIVE_PLAN_MISSING");
    await query(
      "INSERT INTO tenants(id,name,slug,status) VALUES($1,'Renvix synthetic unified AI verification',$2,'active')",
      [tenantId, `live-unified-ai-${tenantId}`]
    );
    await query(
      "INSERT INTO users(id,tenant_id,name,email,email_verified,role) VALUES($1,$2,'Synthetic Unified AI',$3,true,'owner')",
      [userId, tenantId, `live-unified-ai-${userId}@example.test`]
    );
    await query(
      `INSERT INTO platform_subscriptions
        (id,tenant_id,plan_id,status,billing_cycle,current_period_start,current_period_end,trial_started_at,trial_ends_at)
       VALUES($1,$2,$3,'trial','monthly',now()-interval '1 day',now()+interval '6 days',now()-interval '1 day',now()+interval '6 days')`,
      [subscriptionId, tenantId, plan.rows[0].id]
    );
    const starting = await getAIEntitlementSummary(session);
    assert(starting.remainingTokens === 100_000, "UNIFIED_AI_LIVE_STARTING_BALANCE_INVALID");
    const provider = new DeepSeekProvider();
    const model = provider.modelFor("flash");

    for (const taskType of TASK_TYPES) {
      const run = await createAIRun(session, { taskType });
      const reservation = await reserveAITokens(session, { requestedTokens: 256, minimumTokens: 128 });
      let response;
      try {
        response = await provider.completeStructured({
          model,
          messages: [{ role: "user", content: "Respond only with: OK" }],
          maxTokens: 8,
          thinking: "disabled"
        });
      } catch (error) {
        await releaseAITokenReservation(session, reservation.id);
        await finishAIRun(session, run.id, { status: "failed" });
        throw error;
      }
      const usage = response.usage || {};
      const actualTokens = Number(usage.total_tokens || 0) ||
        Number(usage.prompt_tokens || 0) + Number(usage.completion_tokens || 0);
      assert(actualTokens > 0 && response.providerRequestId, "UNIFIED_AI_LIVE_PROVIDER_USAGE_INVALID");
      const idempotencyKey = `live-unified-ai:${taskType}:${crypto.randomUUID()}`;
      const settled = await settleAITokenReservation(session, reservation.id, {
        aiRunId: run.id,
        taskType,
        providerRequestId: response.providerRequestId,
        idempotencyKey,
        model,
        routingMode: "flash",
        usage
      });
      assert(settled.idempotent === false && settled.actualTokens === actualTokens, "UNIFIED_AI_LIVE_SETTLEMENT_INVALID");
      chargedByTask[taskType] = actualTokens;

      const retryReservation = await reserveAITokens(session, { requestedTokens: 128, minimumTokens: 128 });
      const retry = await settleAITokenReservation(session, retryReservation.id, {
        taskType,
        providerRequestId: response.providerRequestId,
        idempotencyKey,
        model,
        routingMode: "flash",
        usage
      });
      assert(retry.idempotent === true && retry.actualTokens === actualTokens, "UNIFIED_AI_LIVE_RETRY_DEDUCTED");
    }

    const charged = Object.values(chargedByTask).reduce((sum, value) => sum + Number(value || 0), 0);
    const final = await getAIEntitlementSummary(session);
    assert(final.remainingTokens === starting.remainingTokens - charged, "UNIFIED_AI_LIVE_BALANCE_MISMATCH");
    assert(final.reservedTokens === 0, "UNIFIED_AI_LIVE_RESERVATION_LEAK");
    const audit = await query(
      `SELECT count(*)::int AS count,count(DISTINCT cycle_id)::int AS cycles,
              count(DISTINCT task_type)::int AS task_types,COALESCE(sum(actual_tokens),0)::int AS charged
         FROM ai_token_usage_ledger WHERE tenant_id=$1`,
      [tenantId]
    );
    assert(audit.rows[0]?.count === TASK_TYPES.length, "UNIFIED_AI_LIVE_LEDGER_COUNT_INVALID");
    assert(audit.rows[0]?.cycles === 1 && audit.rows[0]?.task_types === TASK_TYPES.length, "UNIFIED_AI_LIVE_NOT_UNIFIED");
    assert(audit.rows[0]?.charged === charged, "UNIFIED_AI_LIVE_LEDGER_BALANCE_MISMATCH");
    process.stdout.write(`${JSON.stringify({
      ok: true,
      provider: "deepseek",
      providerCalls: TASK_TYPES.length,
      startingBalance: starting.remainingTokens,
      chargedByTask,
      finalBalance: final.remainingTokens,
      unifiedCycle: true,
      retryIdempotency: "PASS"
    })}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({
      ok: false,
      code: String(error?.code || "UNIFIED_AI_LIVE_FAILED"),
      message: "Synthetic unified AI verification failed. No secret, prompt, generated content, or customer data was logged."
    })}\n`);
    process.exitCode = 1;
  } finally {
    await query("DELETE FROM users WHERE id=$1", [userId]).catch(() => {});
    await query("DELETE FROM tenant_storage_usage WHERE tenant_id=$1", [tenantId]).catch(() => {});
    await query("DELETE FROM tenants WHERE id=$1", [tenantId]).catch(() => {});
    await getPool().end().catch(() => {});
  }
}
