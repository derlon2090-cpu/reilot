import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { query } from "../../src/server/db.js";
import {
  getAIEntitlementSnapshot,
  getAIEntitlementSummary,
  releaseAITokenReservation,
  reserveAITokens,
  settleAITokenReservation
} from "../../src/server/ai/entitlements.js";

const tenantId = crypto.randomUUID();
const userId = crypto.randomUUID();
const subscriptionId = crypto.randomUUID();
const session = { tenantId, userId };
const missingTrialTenantId = crypto.randomUUID();
const missingTrialUserId = crypto.randomUUID();
const missingTrialSession = { tenantId: missingTrialTenantId, userId: missingTrialUserId };

describe.sequential("AI entitlement PostgreSQL lifecycle", () => {
  beforeAll(async () => {
    const plan = await query("SELECT id FROM platform_plans WHERE slug='professional' LIMIT 1");
    if (!plan.rows[0]) throw new Error("professional plan fixture is missing");
    await query("INSERT INTO tenants(id,name,slug,status) VALUES($1,'AI entitlement test',$2,'active')", [tenantId, `ai-ent-${tenantId}`]);
    await query(
      "INSERT INTO users(id,tenant_id,name,email,email_verified,role) VALUES($1,$2,'AI Test',$3,true,'owner')",
      [userId, tenantId, `ai-ent-${userId}@example.test`]
    );
    await query(
      `INSERT INTO platform_subscriptions(id,tenant_id,plan_id,status,billing_cycle,current_period_start,current_period_end)
       VALUES($1,$2,$3,'active','monthly',now()-interval '1 day',now()+interval '30 days')`,
      [subscriptionId, tenantId, plan.rows[0].id]
    );
    await query("INSERT INTO tenants(id,name,slug,status) VALUES($1,'AI missing trial test',$2,'active')", [missingTrialTenantId, `ai-missing-${missingTrialTenantId}`]);
    await query(
      "INSERT INTO users(id,tenant_id,name,email,email_verified,role) VALUES($1,$2,'AI Missing Trial',$3,true,'owner')",
      [missingTrialUserId, missingTrialTenantId, `ai-missing-${missingTrialUserId}@example.test`]
    );
  });

  afterAll(async () => {
    await query("DELETE FROM users WHERE id=$1", [userId]);
    await query("DELETE FROM users WHERE id=$1", [missingTrialUserId]);
    await query("DELETE FROM tenant_storage_usage WHERE tenant_id=$1", [tenantId]);
    await query("DELETE FROM tenant_storage_usage WHERE tenant_id=$1", [missingTrialTenantId]);
    await query("DELETE FROM tenants WHERE id=$1", [missingTrialTenantId]);
    await query("DELETE FROM tenants WHERE id=$1", [tenantId]);
  }, 30_000);

  it("materializes one period with exactly four Professional cycles and no cycle five", async () => {
    const usage = await getAIEntitlementSummary(session);
    expect(usage).toMatchObject({ allowanceTokens: 3_000_000, remainingTokens: 3_000_000, cycleNumber: 1, maxCycles: 4 });
    const snapshot = await getAIEntitlementSnapshot(session);
    expect(snapshot).toMatchObject({ allowanceTokens: 3_000_000, remainingTokens: 3_000_000, cycleNumber: 1, maxCycles: 4 });
    const cycles = await query(
      `SELECT cycle_number AS "cycleNumber",allowance_tokens AS "allowanceTokens"
       FROM ai_entitlement_cycles WHERE tenant_id=$1 ORDER BY cycle_number`, [tenantId]
    );
    expect(cycles.rows).toHaveLength(4);
    expect(cycles.rows.every((cycle) => Number(cycle.allowanceTokens) === 3_000_000)).toBe(true);
    await expect(query(
      `INSERT INTO ai_entitlement_cycles
       (entitlement_period_id,tenant_id,cycle_number,cycle_start,cycle_end,access_ends_at,allowance_tokens)
       SELECT entitlement_period_id,tenant_id,5,now(),now()+interval '7 days',now()+interval '7 days',3000000
       FROM ai_entitlement_cycles WHERE tenant_id=$1 LIMIT 1`, [tenantId]
    )).rejects.toMatchObject({ code: "23514" });
  });

  it("self-heals the one missing trial subscription for a new account", async () => {
    const usage = await getAIEntitlementSummary(missingTrialSession);
    expect(usage).toMatchObject({ allowanceTokens: 100_000, remainingTokens: 100_000, cycleNumber: 1, maxCycles: 1 });
    const subscriptions = await query(
      "SELECT count(*)::int AS count,max(status) AS status FROM platform_subscriptions WHERE tenant_id=$1",
      [missingTrialTenantId]
    );
    expect(subscriptions.rows[0]).toMatchObject({ count: 1, status: "trial" });
  });

  it("reports an expired trial as a terminal entitlement without reminting the Free balance", async () => {
    await query(
      `UPDATE platform_subscriptions SET status='expired',current_period_end=now()-interval '1 day',
         trial_ends_at=now()-interval '1 day' WHERE tenant_id=$1`,
      [missingTrialTenantId]
    );
    await expect(getAIEntitlementSummary(missingTrialSession)).rejects.toMatchObject({
      code: "AI_ENTITLEMENT_INACTIVE",
      status: 403,
      entitlement: { state: "inactive", reason: "trial_expired", status: "expired", planSlug: "trial" }
    });
    const subscriptions = await query(
      "SELECT count(*)::int AS count FROM platform_subscriptions WHERE tenant_id=$1",
      [missingTrialTenantId]
    );
    expect(subscriptions.rows[0].count).toBe(1);
  });

  it("settles only actual response.usage and deduplicates a provider request id", async () => {
    const reservation = await reserveAITokens(session, { requestedTokens: 20_000, minimumTokens: 128 });
    const settled = await settleAITokenReservation(session, reservation.id, {
      providerRequestId: "provider-actual-usage-1",
      model: "deepseek-v4-flash",
      taskType: "email_template_code_generate",
      usage: { prompt_tokens: 10_000, completion_tokens: 2_435, prompt_cache_hit_tokens: 4_000 }
    });
    expect(settled.actualTokens).toBe(12_435);
    const usage = await getAIEntitlementSummary(session);
    expect(usage.usedTokens).toBe(12_435);
    expect(usage.remainingTokens).toBe(2_987_565);

    const secondReservation = await reserveAITokens(session, { requestedTokens: 20_000, minimumTokens: 128 });
    const duplicate = await settleAITokenReservation(session, secondReservation.id, {
      providerRequestId: "provider-actual-usage-1",
      model: "deepseek-v4-flash",
      usage: { prompt_tokens: 10_000, completion_tokens: 2_435 }
    });
    expect(duplicate).toMatchObject({ idempotent: true, actualTokens: 12_435 });
    const ledger = await query("SELECT count(*)::int AS count FROM ai_token_usage_ledger WHERE tenant_id=$1", [tenantId]);
    expect(ledger.rows[0].count).toBe(1);
    const taskLedger = await query(
      `SELECT token.task_type AS "tokenTaskType",provider.task_type AS "providerTaskType"
         FROM ai_token_usage_ledger token
         JOIN ai_provider_usage_ledger provider ON provider.reservation_id=token.reservation_id
        WHERE token.tenant_id=$1 AND token.provider_request_id=$2 LIMIT 1`,
      [tenantId, "provider-actual-usage-1"]
    );
    expect(taskLedger.rows[0]).toMatchObject({
      tokenTaskType: "email_template_code_generate",
      providerTaskType: "email_template_code_generate"
    });
  });

  it("aggregates a three-call message into one auditable 4,300-token deduction", async () => {
    const before = await getAIEntitlementSummary(session);
    const reservation = await reserveAITokens(session, { requestedTokens: 8_000, minimumTokens: 128 });
    const result = await settleAITokenReservation(session, reservation.id, {
      providerRequestId: "provider-multi-call-message-1",
      model: "deepseek-v4-flash",
      usage: { prompt_tokens: 3_500, completion_tokens: 800 }
    });
    const after = await getAIEntitlementSummary(session);
    expect(result.actualTokens).toBe(4_300);
    expect(after.usedTokens - before.usedTokens).toBe(4_300);
    const entry = await query(
      "SELECT count(*)::int AS count, max(actual_tokens)::bigint AS actual FROM ai_token_usage_ledger WHERE tenant_id=$1 AND provider_request_id=$2",
      [tenantId, "provider-multi-call-message-1"]
    );
    expect(entry.rows[0]).toMatchObject({ count: 1, actual: "4300" });
  });

  it("serializes five concurrent requests so reservations cannot exceed the final 10K", async () => {
    const cycle = await query("SELECT id,allowance_tokens FROM ai_entitlement_cycles WHERE tenant_id=$1 AND status='active' LIMIT 1", [tenantId]);
    await query(
      "UPDATE ai_entitlement_cycles SET used_tokens=allowance_tokens-10000,reserved_tokens=0 WHERE id=$1",
      [cycle.rows[0].id]
    );
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => reserveAITokens(session, {
      requestedTokens: 3_000, minimumTokens: 128
    })));
    const successful = results.filter((result) => result.status === "fulfilled");
    const locked = await query(
      "SELECT used_tokens AS used,reserved_tokens AS reserved,allowance_tokens AS allowance FROM ai_entitlement_cycles WHERE id=$1",
      [cycle.rows[0].id]
    );
    expect(successful.length).toBeGreaterThan(0);
    expect(Number(locked.rows[0].reserved)).toBe(10_000);
    expect(Number(locked.rows[0].used) + Number(locked.rows[0].reserved)).toBeLessThanOrEqual(Number(locked.rows[0].allowance));
    await Promise.all(successful.map((result) => releaseAITokenReservation(session, result.value.id)));
  });

  it("does not create a new entitlement period after a failed renewal", async () => {
    await query("UPDATE platform_subscriptions SET status='past_due' WHERE id=$1", [subscriptionId]);
    await expect(getAIEntitlementSummary(session)).rejects.toMatchObject({ code: "AI_ENTITLEMENT_INACTIVE", status: 403 });
    const periods = await query("SELECT count(*)::int AS count FROM ai_entitlement_periods WHERE tenant_id=$1", [tenantId]);
    expect(periods.rows[0].count).toBe(1);
  });

  it("never remints the Free 100K when the trial dates are extended", async () => {
    const trialPlan = await query("SELECT id FROM platform_plans WHERE slug='trial' LIMIT 1");
    const trialSubscriptionId = crypto.randomUUID();
    await query(
      `INSERT INTO platform_subscriptions(id,tenant_id,plan_id,status,billing_cycle,current_period_start,current_period_end)
       VALUES($1,$2,$3,'trial','monthly',now()-interval '8 days',now()+interval '22 days')`,
      [trialSubscriptionId, tenantId, trialPlan.rows[0].id]
    );
    const initial = await getAIEntitlementSummary(session);
    expect(initial).toMatchObject({ allowanceTokens: 100_000, cycleNumber: 1, maxCycles: 1 });
    const reservation = await reserveAITokens(session, { requestedTokens: 10_000, minimumTokens: 128 });
    await settleAITokenReservation(session, reservation.id, {
      providerRequestId: "trial-usage-once", model: "deepseek-v4-flash",
      usage: { prompt_tokens: 4_000, completion_tokens: 1_000 }
    });
    await query(
      `UPDATE platform_subscriptions SET current_period_start=now()-interval '1 day',
         current_period_end=now()+interval '30 days' WHERE id=$1`, [trialSubscriptionId]
    );
    const extended = await getAIEntitlementSummary(session);
    expect(extended).toMatchObject({ allowanceTokens: 100_000, usedTokens: 5_000, remainingTokens: 95_000, cycleNumber: 1 });
    const trialPeriods = await query(
      "SELECT count(*)::int AS count FROM ai_entitlement_periods WHERE subscription_id=$1", [trialSubscriptionId]
    );
    expect(trialPeriods.rows[0].count).toBe(1);

    await query("UPDATE platform_subscriptions SET status='canceled' WHERE id=$1", [trialSubscriptionId]);
    const replacementTrialId = crypto.randomUUID();
    await query(
      `INSERT INTO platform_subscriptions(id,tenant_id,plan_id,status,billing_cycle,current_period_start,current_period_end)
       VALUES($1,$2,$3,'trial','monthly',now(),now()+interval '30 days')`,
      [replacementTrialId, tenantId, trialPlan.rows[0].id]
    );
    const replacement = await getAIEntitlementSummary(session);
    expect(replacement).toMatchObject({ allowanceTokens: 100_000, usedTokens: 5_000, remainingTokens: 95_000 });
    const tenantTrialPeriods = await query(
      "SELECT count(*)::int AS count FROM ai_entitlement_periods WHERE tenant_id=$1 AND plan_slug IN ('trial','retired_free')",
      [tenantId]
    );
    expect(tenantTrialPeriods.rows[0].count).toBe(1);
  });
});
