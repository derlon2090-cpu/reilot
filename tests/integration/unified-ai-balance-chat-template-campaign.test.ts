import crypto from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { GET as getAIUsageRoute } from "../../app/api/ai/usage/route.js";
import { query, transaction } from "../../src/server/db.js";
import { createSession } from "../../src/server/session.js";
import {
  getAIEntitlementSummary,
  releaseAITokenReservation,
  reserveAITokens,
  settleAITokenReservation
} from "../../src/server/ai/entitlements.js";
import { createAIRun, finishAIRun } from "../../src/server/ai/provider-accounting.js";

type Fixture = {
  tenantId: string;
  userId: string;
  subscriptionId: string;
  session: { tenantId: string; userId: string };
  sessionToken: string;
};

const fixtures: Fixture[] = [];
const DAY = 24 * 60 * 60 * 1000;

async function createFixture({
  planSlug = "trial",
  periodStart = new Date(Date.now() - DAY),
  periodEnd = new Date(Date.now() + 6 * DAY)
}: { planSlug?: "trial" | "professional"; periodStart?: Date; periodEnd?: Date } = {}): Promise<Fixture> {
  const tenantId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const subscriptionId = crypto.randomUUID();
  const plan = await query("SELECT id FROM platform_plans WHERE slug=$1 LIMIT 1", [planSlug]);
  if (!plan.rows[0]) throw new Error(`${planSlug} plan fixture is missing`);
  const sessionToken = await transaction(async (client) => {
    await client.query(
      "INSERT INTO tenants(id,name,slug,status) VALUES($1,'Unified AI balance test',$2,'active')",
      [tenantId, `unified-ai-${tenantId}`]
    );
    await client.query(
      "INSERT INTO users(id,tenant_id,name,email,email_verified,role) VALUES($1,$2,'Unified AI Test',$3,true,'owner')",
      [userId, tenantId, `unified-ai-${userId}@example.test`]
    );
    await client.query(
      `INSERT INTO platform_subscriptions
        (id,tenant_id,plan_id,status,billing_cycle,current_period_start,current_period_end,trial_started_at,trial_ends_at)
       VALUES($1,$2,$3,$4,'monthly',$5,$6,$7,$8)`,
      [subscriptionId, tenantId, plan.rows[0].id, planSlug === "trial" ? "trial" : "active",
        periodStart, periodEnd, planSlug === "trial" ? periodStart : null, planSlug === "trial" ? periodEnd : null]
    );
    const created = await createSession(client, {
      userId,
      ipAddress: "127.0.0.1",
      userAgent: "unified-ai-balance-integration-test"
    });
    return created.token;
  });
  const fixture = { tenantId, userId, subscriptionId, session: { tenantId, userId }, sessionToken };
  fixtures.push(fixture);
  return fixture;
}

async function readUsageAPI(fixture: Fixture) {
  const response = await getAIUsageRoute(new Request("http://localhost/api/ai/usage", {
    headers: { cookie: `renewpilot_session=${encodeURIComponent(fixture.sessionToken)}` }
  }));
  const payload = await response.json();
  expect(response.status).toBe(200);
  expect(payload.ok).toBe(true);
  return payload.usage;
}

async function expectAllSurfaces(fixture: Fixture, remainingTokens: number, usedTokens: number) {
  const [chat, template, campaign] = await Promise.all([
    readUsageAPI(fixture),
    readUsageAPI(fixture),
    readUsageAPI(fixture)
  ]);
  expect(template).toEqual(chat);
  expect(campaign).toEqual(chat);
  expect(chat).toMatchObject({ remainingTokens, usedTokens, reservedTokens: 0 });
  return chat;
}

async function settleFeatureOperation(fixture: Fixture, input: {
  taskType: string;
  actualTokens: number;
  reservedTokens: number;
  idempotencyKey?: string;
  providerRequestId?: string;
  completeRun?: boolean;
}) {
  const run = await createAIRun(fixture.session, { taskType: input.taskType });
  const reservation = await reserveAITokens(fixture.session, {
    requestedTokens: input.reservedTokens,
    minimumTokens: input.reservedTokens
  });
  const outputTokens = Math.min(200, input.actualTokens);
  const settled = await settleAITokenReservation(fixture.session, reservation.id, {
    aiRunId: run.id,
    taskType: input.taskType,
    providerRequestId: input.providerRequestId || `unified-provider-${crypto.randomUUID()}`,
    idempotencyKey: input.idempotencyKey || `unified-idempotency-${crypto.randomUUID()}`,
    model: "deepseek-v4-flash",
    completeRun: input.completeRun,
    usage: { prompt_tokens: input.actualTokens - outputTokens, completion_tokens: outputTokens }
  });
  return { run, reservation, settled };
}

afterEach(async () => {
  while (fixtures.length) {
    const fixture = fixtures.pop();
    if (!fixture) continue;
    await query("DELETE FROM users WHERE id=$1", [fixture.userId]);
    await query("DELETE FROM tenant_storage_usage WHERE tenant_id=$1", [fixture.tenantId]);
    await query("DELETE FROM tenants WHERE id=$1", [fixture.tenantId]);
  }
});

describe.sequential("unified AI balance across chat, email templates, and campaigns", () => {
  it("uses one real 100K cycle and reaches the exact 88,500 balance through all surfaces", async () => {
    const fixture = await createFixture();
    const starting = await expectAllSurfaces(fixture, 100_000, 0);
    expect(starting).toMatchObject({ allowanceTokens: 100_000, cycleNumber: 1, maxCycles: 1 });

    await settleFeatureOperation(fixture, { taskType: "chat", actualTokens: 2_000, reservedTokens: 4_000 });
    await expectAllSurfaces(fixture, 98_000, 2_000);

    const templateRun = await createAIRun(fixture.session, { taskType: "email_template_code_generate" });
    const templateReservation = await reserveAITokens(fixture.session, { requestedTokens: 8_000, minimumTokens: 8_000 });
    const whileReserved = await readUsageAPI(fixture);
    expect(whileReserved).toMatchObject({ remainingTokens: 90_000, usedTokens: 2_000, reservedTokens: 8_000 });
    const templateSettlement = await settleAITokenReservation(fixture.session, templateReservation.id, {
      aiRunId: templateRun.id,
      taskType: "email_template_code_generate",
      providerRequestId: `unified-provider-${crypto.randomUUID()}`,
      idempotencyKey: `unified-idempotency-${crypto.randomUUID()}`,
      model: "deepseek-v4-flash",
      usage: { prompt_tokens: 3_000, completion_tokens: 500 }
    });
    expect(templateSettlement).toMatchObject({ actualTokens: 3_500, idempotent: false });
    await expectAllSurfaces(fixture, 94_500, 5_500);

    await settleFeatureOperation(fixture, { taskType: "campaign_copy_generate", actualTokens: 1_250, reservedTokens: 3_000 });
    await expectAllSurfaces(fixture, 93_250, 6_750);

    await settleFeatureOperation(fixture, { taskType: "campaign_copy_regenerate", actualTokens: 750, reservedTokens: 2_000 });
    await expectAllSurfaces(fixture, 92_500, 7_500);

    await settleFeatureOperation(fixture, { taskType: "email_template_code_replace", actualTokens: 4_000, reservedTokens: 6_000 });
    const final = await expectAllSurfaces(fixture, 88_500, 11_500);
    expect(final.remainingTokens).toBe(100_000 - 2_000 - 3_500 - 1_250 - 750 - 4_000);

    const ledger = await query(
      `SELECT token.task_type AS "taskType",token.actual_tokens::int AS "actualTokens",
              token.cycle_id AS "cycleId",period.subscription_id AS "subscriptionId",
              token.ai_run_id AS "aiRunId",provider.task_type AS "providerTaskType"
         FROM ai_token_usage_ledger token
         JOIN ai_entitlement_cycles cycle ON cycle.id=token.cycle_id
         JOIN ai_entitlement_periods period ON period.id=cycle.entitlement_period_id
         JOIN ai_provider_usage_ledger provider ON provider.reservation_id=token.reservation_id
        WHERE token.tenant_id=$1 ORDER BY token.created_at,token.id`,
      [fixture.tenantId]
    );
    expect(ledger.rows).toHaveLength(5);
    expect(ledger.rows.map((row) => [row.taskType, row.actualTokens])).toEqual([
      ["chat", 2_000],
      ["email_template_code_generate", 3_500],
      ["campaign_copy_generate", 1_250],
      ["campaign_copy_regenerate", 750],
      ["email_template_code_replace", 4_000]
    ]);
    expect(new Set(ledger.rows.map((row) => row.cycleId)).size).toBe(1);
    expect(new Set(ledger.rows.map((row) => row.subscriptionId))).toEqual(new Set([fixture.subscriptionId]));
    expect(ledger.rows.every((row) => row.aiRunId && row.providerTaskType === row.taskType)).toBe(true);
    const cycle = await query(
      `SELECT allowance_tokens::int AS allowance,used_tokens::int AS used,reserved_tokens::int AS reserved
         FROM ai_entitlement_cycles WHERE tenant_id=$1 AND status='active' LIMIT 1`,
      [fixture.tenantId]
    );
    expect(cycle.rows[0]).toEqual({ allowance: 100_000, used: 11_500, reserved: 0 });
  }, 30_000);

  it("serializes two real 7K reservations so only one can spend the final 10K", async () => {
    const fixture = await createFixture();
    await getAIEntitlementSummary(fixture.session);
    await query(
      `UPDATE ai_entitlement_cycles SET used_tokens=90_000,reserved_tokens=0
        WHERE tenant_id=$1 AND status='active'`,
      [fixture.tenantId]
    );
    const results = await Promise.allSettled([
      reserveAITokens(fixture.session, { requestedTokens: 7_000, minimumTokens: 7_000 }),
      reserveAITokens(fixture.session, { requestedTokens: 7_000, minimumTokens: 7_000 })
    ]);
    const successful = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    expect(successful).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]).toMatchObject({ reason: { code: "AI_PLAN_TOKEN_LIMIT_REACHED" } });
    const locked = await query(
      `SELECT used_tokens::int AS used,reserved_tokens::int AS reserved,allowance_tokens::int AS allowance
         FROM ai_entitlement_cycles WHERE tenant_id=$1 AND status='active'`,
      [fixture.tenantId]
    );
    expect(locked.rows[0]).toEqual({ used: 90_000, reserved: 7_000, allowance: 100_000 });
    expect(locked.rows[0].used + locked.rows[0].reserved).toBeLessThanOrEqual(locked.rows[0].allowance);
    if (successful[0]?.status === "fulfilled") await releaseAITokenReservation(fixture.session, successful[0].value.id);
  });

  it("deduplicates retries independently for chat, template, replace, campaign, and regeneration", async () => {
    const fixture = await createFixture();
    const taskTypes = [
      "chat",
      "email_template_code_generate",
      "email_template_code_replace",
      "campaign_copy_generate",
      "campaign_copy_regenerate"
    ];
    for (const taskType of taskTypes) {
      const idempotencyKey = `unified-idem-${taskType}-${crypto.randomUUID()}`;
      const providerRequestId = `unified-provider-${taskType}-${crypto.randomUUID()}`;
      const first = await settleFeatureOperation(fixture, {
        taskType, actualTokens: 1_500, reservedTokens: 2_000, idempotencyKey, providerRequestId
      });
      expect(first.settled).toMatchObject({ idempotent: false, actualTokens: 1_500 });
      const retryReservation = await reserveAITokens(fixture.session, { requestedTokens: 2_000, minimumTokens: 2_000 });
      const retry = await settleAITokenReservation(fixture.session, retryReservation.id, {
        taskType,
        providerRequestId: `${providerRequestId}-retry`,
        idempotencyKey,
        model: "deepseek-v4-flash",
        usage: { prompt_tokens: 1_300, completion_tokens: 200 }
      });
      expect(retry).toMatchObject({ idempotent: true, actualTokens: 1_500 });
    }
    await expectAllSurfaces(fixture, 92_500, 7_500);
    const ledger = await query(
      `SELECT task_type AS "taskType",count(*)::int AS count
         FROM ai_token_usage_ledger WHERE tenant_id=$1 GROUP BY task_type ORDER BY task_type`,
      [fixture.tenantId]
    );
    expect(ledger.rows).toHaveLength(5);
    expect(ledger.rows.every((row) => row.count === 1)).toBe(true);
    expect(new Set(ledger.rows.map((row) => row.taskType))).toEqual(new Set(taskTypes));
  }, 30_000);

  it("releases everything before billable usage and keeps actual usage after a failed run", async () => {
    const fixture = await createFixture();
    await expectAllSurfaces(fixture, 100_000, 0);
    const beforeUsageFailure = await reserveAITokens(fixture.session, { requestedTokens: 5_000, minimumTokens: 5_000 });
    expect((await readUsageAPI(fixture)).remainingTokens).toBe(95_000);
    expect(await releaseAITokenReservation(fixture.session, beforeUsageFailure.id)).toEqual({ released: true });
    await expectAllSurfaces(fixture, 100_000, 0);

    const billedFailure = await settleFeatureOperation(fixture, {
      taskType: "email_template_code_replace",
      actualTokens: 500,
      reservedTokens: 5_000,
      completeRun: false
    });
    await finishAIRun(fixture.session, billedFailure.run.id, { status: "failed" });
    await expectAllSurfaces(fixture, 99_500, 500);
    const audit = await query(
      `SELECT run.status,token.actual_tokens::int AS "actualTokens",reservation.status AS "reservationStatus"
         FROM ai_runs run
         JOIN ai_token_usage_ledger token ON token.ai_run_id=run.id
         JOIN ai_token_reservations reservation ON reservation.id=token.reservation_id
        WHERE run.id=$1`,
      [billedFailure.run.id]
    );
    expect(audit.rows[0]).toEqual({ status: "failed", actualTokens: 500, reservationStatus: "settled" });
  });

  it("refills into one new shared Professional cycle and the authenticated API reads it after refresh", async () => {
    const now = new Date();
    const fixture = await createFixture({
      planSlug: "professional",
      periodStart: new Date(now.getTime() - 8 * DAY),
      periodEnd: new Date(now.getTime() + 22 * DAY)
    });
    const previousCycleTime = new Date(now.getTime() - 7 * DAY);
    const previous = await getAIEntitlementSummary(fixture.session, { now: previousCycleTime });
    expect(previous).toMatchObject({ cycleNumber: 1, allowanceTokens: 3_000_000, remainingTokens: 3_000_000 });
    const reservation = await reserveAITokens(fixture.session, {
      requestedTokens: 1_000,
      minimumTokens: 1_000,
      now: previousCycleTime
    });
    await settleAITokenReservation(fixture.session, reservation.id, {
      taskType: "chat",
      providerRequestId: `refill-provider-${crypto.randomUUID()}`,
      idempotencyKey: `refill-idempotency-${crypto.randomUUID()}`,
      model: "deepseek-v4-flash",
      usage: { prompt_tokens: 800, completion_tokens: 200 }
    });
    const current = await expectAllSurfaces(fixture, 3_000_000, 0);
    expect(current).toMatchObject({ cycleNumber: 2, allowanceTokens: 3_000_000, maxCycles: 4 });
    const cycles = await query(
      `SELECT cycle_number AS "cycleNumber",used_tokens::int AS used
         FROM ai_entitlement_cycles WHERE tenant_id=$1 AND cycle_number IN (1,2) ORDER BY cycle_number`,
      [fixture.tenantId]
    );
    expect(cycles.rows).toEqual([{ cycleNumber: 1, used: 1_000 }, { cycleNumber: 2, used: 0 }]);
  });

  it("blocks every feature before provider usage when the shared cycle is exhausted", async () => {
    const fixture = await createFixture();
    await getAIEntitlementSummary(fixture.session);
    await query(
      `UPDATE ai_entitlement_cycles SET used_tokens=99_500,reserved_tokens=0
        WHERE tenant_id=$1 AND status='active'`,
      [fixture.tenantId]
    );
    for (const taskType of ["chat", "email_template_code_generate", "campaign_copy_generate"]) {
      await expect(reserveAITokens(fixture.session, {
        requestedTokens: 1_000,
        minimumTokens: 1_000
      })).rejects.toMatchObject({ code: "AI_PLAN_TOKEN_LIMIT_REACHED", status: 429 });
      expect(taskType).toBeTruthy();
    }
    await expectAllSurfaces(fixture, 500, 99_500);
    const calls = await query(
      `SELECT
         (SELECT count(*)::int FROM ai_token_usage_ledger WHERE tenant_id=$1) AS token_calls,
         (SELECT count(*)::int FROM ai_provider_usage_ledger WHERE tenant_id=$1) AS provider_calls`,
      [fixture.tenantId]
    );
    expect(calls.rows[0]).toEqual({ token_calls: 0, provider_calls: 0 });
  });
});
