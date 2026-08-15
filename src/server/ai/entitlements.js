import { query, transaction } from "../db.js";
import {
  aiUsageWarningLevel,
  buildAIEntitlementCycles,
  getAIPlanPolicy,
  resolveAIEntitlementCycle
} from "./entitlement-policy.js";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trial"]);
const safeInteger = (value) => Math.max(0, Math.floor(Number(value || 0)));

function entitlementError(code, message, status = 429, details = {}) {
  return Object.assign(new Error(message), { code, status, ...details });
}

function actualTokenUsage(usage = {}) {
  const inputTokens = safeInteger(usage.prompt_tokens ?? usage.input_tokens);
  const outputTokens = safeInteger(usage.completion_tokens ?? usage.output_tokens);
  return {
    inputTokens,
    outputTokens,
    actualTokens: inputTokens + outputTokens,
    cacheHitTokens: safeInteger(usage.prompt_cache_hit_tokens ?? usage.cache_hit_tokens),
    cacheMissTokens: safeInteger(usage.prompt_cache_miss_tokens ?? usage.cache_miss_tokens)
  };
}

function modelCostMicros(model, usage) {
  const pro = String(model || "").includes("pro");
  const prefix = pro ? "AI_PRO" : "AI_FLASH";
  const inputRate = safeInteger(process.env[`${prefix}_INPUT_COST_MICROS_PER_MILLION`]);
  const outputRate = safeInteger(process.env[`${prefix}_OUTPUT_COST_MICROS_PER_MILLION`]);
  const cacheHitRate = safeInteger(process.env[`${prefix}_CACHE_HIT_COST_MICROS_PER_MILLION`]);
  const nonCachedInput = Math.max(0, usage.inputTokens - usage.cacheHitTokens);
  return Math.round((nonCachedInput * inputRate + usage.outputTokens * outputRate + usage.cacheHitTokens * cacheHitRate) / 1_000_000);
}

async function activeSubscription(tenantId, now, runner) {
  const result = await runner.query(
    `SELECT ps.id AS "subscriptionId",ps.status,ps.current_period_start AS "periodStart",
            ps.current_period_end AS "periodEnd",pp.name AS "planName",pp.slug AS "planSlug",
            pp.ai_weekly_token_limit AS "weeklyTokenLimit",pp.ai_period_token_cap AS "periodTokenCap",
            pp.ai_max_cycles AS "maxCycles"
       FROM platform_subscriptions ps JOIN platform_plans pp ON pp.id=ps.plan_id
      WHERE ps.tenant_id=$1 AND ps.status IN ('active','trial')
        AND ps.current_period_start <= $2::timestamptz + interval '1 minute' AND ps.current_period_end > $2::timestamptz
      ORDER BY CASE ps.status WHEN 'active' THEN 0 ELSE 1 END,ps.created_at DESC LIMIT 1`,
    [tenantId, now]
  );
  return result.rows[0] || null;
}

async function provisionMissingTrialSubscription(tenantId, runner) {
  const result = await runner.query(
    `INSERT INTO platform_subscriptions
       (tenant_id,plan_id,status,billing_cycle,current_period_start,current_period_end,trial_started_at,trial_ends_at)
     SELECT t.id,pp.id,'trial','monthly',now(),now()+interval '7 days',now(),now()+interval '7 days'
       FROM tenants t
       JOIN platform_plans pp ON pp.slug='trial'
      WHERE t.id=$1 AND t.status IN ('active','trial')
        AND NOT EXISTS (SELECT 1 FROM platform_subscriptions history WHERE history.tenant_id=t.id)
     RETURNING id`,
    [tenantId]
  );
  return Boolean(result.rows[0]);
}

async function materializeEntitlement(tenantId, now, runner) {
  let subscription = await activeSubscription(tenantId, now, runner);
  if (!subscription && await provisionMissingTrialSubscription(tenantId, runner)) {
    subscription = await activeSubscription(tenantId, now, runner);
  }
  if (!subscription || !ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)) {
    await runner.query(
      `UPDATE ai_entitlement_periods SET status='suspended',updated_at=now()
        WHERE tenant_id=$1 AND status='active'`, [tenantId]
    );
    throw entitlementError("AI_ENTITLEMENT_INACTIVE", "لا يوجد اشتراك نشط يمنح رصيد الذكاء حاليًا.", 403);
  }
  const fallback = getAIPlanPolicy(subscription.planSlug);
  const weeklyLimit = safeInteger(subscription.weeklyTokenLimit) || fallback.weeklyLimit;
  const periodCap = safeInteger(subscription.periodTokenCap) || fallback.periodCap;
  const maxCycles = Math.min(4, Math.max(1, safeInteger(subscription.maxCycles) || fallback.maxCycles));
  let periodResult;
  if (maxCycles === 1) {
    periodResult = await runner.query(
      `UPDATE ai_entitlement_periods SET period_end=GREATEST(period_end,$2),status='active',updated_at=now()
        WHERE tenant_id=$1 AND plan_slug IN ('trial','retired_free')
        RETURNING id,period_start AS "periodStart",period_end AS "periodEnd"`,
      [tenantId, subscription.periodEnd]
    );
  }
  if (!periodResult?.rows[0]) {
    periodResult = await runner.query(
      `INSERT INTO ai_entitlement_periods
        (tenant_id,subscription_id,plan_slug,period_start,period_end,weekly_token_limit,period_token_cap,max_cycles,status)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,'active')
       ON CONFLICT(subscription_id,period_start) DO UPDATE SET
         period_end=EXCLUDED.period_end,status='active',weekly_token_limit=EXCLUDED.weekly_token_limit,
         period_token_cap=EXCLUDED.period_token_cap,max_cycles=EXCLUDED.max_cycles,updated_at=now()
       RETURNING id,period_start AS "periodStart",period_end AS "periodEnd"`,
      [tenantId, subscription.subscriptionId, subscription.planSlug, subscription.periodStart, subscription.periodEnd,
        weeklyLimit, periodCap, maxCycles]
    );
  }
  const periodId = periodResult.rows[0].id;
  const entitlementPeriodStart = periodResult.rows[0].periodStart;
  const entitlementPeriodEnd = periodResult.rows[0].periodEnd;
  const closedPeriods = await runner.query(
    `UPDATE ai_entitlement_periods SET status='closed',updated_at=now()
      WHERE tenant_id=$1 AND subscription_id=$2 AND id<>$3 AND status IN ('active','suspended')
      RETURNING id`,
    [tenantId, subscription.subscriptionId, periodId]
  );
  if (closedPeriods.rows.length) {
    await runner.query(
      `UPDATE ai_entitlement_cycles SET status=CASE WHEN status='active' THEN 'closed' ELSE 'expired' END,
         closed_at=COALESCE(closed_at,$2),updated_at=now()
       WHERE entitlement_period_id=ANY($1::uuid[])`,
      [closedPeriods.rows.map((row) => row.id), now]
    );
  }
  const policyCycles = buildAIEntitlementCycles({
    planSlug: subscription.planSlug,
    periodStart: entitlementPeriodStart,
    periodEnd: entitlementPeriodEnd
  }).slice(0, maxCycles);
  for (const cycle of policyCycles) {
    const cycleEnd = cycle.cycleEnd;
    const accessEndsAt = new Date(Math.min(new Date(entitlementPeriodEnd).getTime(), cycle.accessEndsAt.getTime()));
    await runner.query(
      `INSERT INTO ai_entitlement_cycles
        (entitlement_period_id,tenant_id,cycle_number,cycle_start,cycle_end,access_ends_at,allowance_tokens,status)
       VALUES($1,$2,$3,$4,$5,$6,$7,'scheduled')
       ON CONFLICT(entitlement_period_id,cycle_number) DO UPDATE SET
         cycle_start=EXCLUDED.cycle_start,cycle_end=EXCLUDED.cycle_end,access_ends_at=EXCLUDED.access_ends_at,
         allowance_tokens=EXCLUDED.allowance_tokens,updated_at=now()`,
      [periodId, tenantId, cycle.cycleNumber, cycle.cycleStart, cycleEnd, accessEndsAt, weeklyLimit]
    );
  }
  const resolution = resolveAIEntitlementCycle({
    planSlug: subscription.planSlug,
    periodStart: entitlementPeriodStart,
    periodEnd: entitlementPeriodEnd,
    now,
    subscriptionActive: true
  });
  const cycleNumber = Math.min(maxCycles, resolution.cycle?.cycleNumber || 1);
  await runner.query(
    `UPDATE ai_entitlement_cycles SET status=CASE
       WHEN cycle_number=$2 THEN 'active'
       WHEN cycle_start>$3 THEN 'scheduled'
       ELSE 'closed' END,
       closed_at=CASE WHEN cycle_number<$2 THEN COALESCE(closed_at,$3) ELSE NULL END,updated_at=now()
     WHERE entitlement_period_id=$1`,
    [periodId, cycleNumber, now]
  );
  const cycleResult = await runner.query(
    `SELECT id,cycle_number AS "cycleNumber",cycle_start AS "cycleStart",cycle_end AS "cycleEnd",
            access_ends_at AS "accessEndsAt",allowance_tokens AS "allowanceTokens",
            used_tokens AS "usedTokens",reserved_tokens AS "reservedTokens",status
       FROM ai_entitlement_cycles WHERE entitlement_period_id=$1 AND cycle_number=$2 LIMIT 1`,
    [periodId, cycleNumber]
  );
  return {
    ...subscription,
    periodStart: entitlementPeriodStart,
    periodEnd: entitlementPeriodEnd,
    weeklyLimit,
    periodCap,
    maxCycles,
    periodId,
    state: resolution.state,
    cycle: cycleResult.rows[0]
  };
}

async function releaseExpiredReservations(tenantId, runner) {
  const expired = await runner.query(
    `UPDATE ai_token_reservations SET status='expired',updated_at=now()
      WHERE tenant_id=$1 AND status='reserved' AND expires_at<=now()
      RETURNING cycle_id AS "cycleId",requested_tokens AS "requestedTokens"`,
    [tenantId]
  );
  for (const item of expired.rows) {
    await runner.query(
      `UPDATE ai_entitlement_cycles SET reserved_tokens=GREATEST(0,reserved_tokens-$2),updated_at=now() WHERE id=$1`,
      [item.cycleId, item.requestedTokens]
    );
  }
}

function usageSummary(entitlement, requestCount = 0) {
  const cycle = entitlement.cycle;
  const allowanceTokens = safeInteger(cycle.allowanceTokens);
  const usedTokens = safeInteger(cycle.usedTokens);
  const reservedTokens = safeInteger(cycle.reservedTokens);
  const remainingTokens = Math.max(0, allowanceTokens - usedTokens - reservedTokens);
  const percent = allowanceTokens ? Math.min(100, Math.round((usedTokens / allowanceTokens) * 1000) / 10) : 100;
  const cycleEnd = new Date(cycle.cycleEnd);
  const periodEnd = new Date(entitlement.periodEnd);
  const canRefill = entitlement.maxCycles > 1 && cycle.cycleNumber < entitlement.maxCycles && cycleEnd < periodEnd;
  return {
    planName: entitlement.planName,
    planSlug: entitlement.planSlug,
    limitTokens: allowanceTokens,
    allowanceTokens,
    usedTokens,
    reservedTokens,
    remainingTokens,
    requestCount: safeInteger(requestCount),
    percent,
    warningLevel: aiUsageWarningLevel(percent),
    unlimited: false,
    periodStart: entitlement.periodStart,
    periodEnd: entitlement.periodEnd,
    periodTokenCap: entitlement.periodCap,
    cycleNumber: cycle.cycleNumber,
    maxCycles: entitlement.maxCycles,
    cycleStart: cycle.cycleStart,
    cycleEnd: cycle.cycleEnd,
    accessEndsAt: cycle.accessEndsAt,
    nextRefillAt: canRefill ? cycle.cycleEnd : null,
    entitlementState: entitlement.state,
    refillMode: "refill_to_cap"
  };
}

export async function getAIEntitlementSummary(session, { now = new Date() } = {}) {
  return transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [String(session.tenantId)]);
    await releaseExpiredReservations(session.tenantId, client);
    const entitlement = await materializeEntitlement(session.tenantId, now, client);
    const requestCount = await client.query(
      `SELECT count(*)::int AS count FROM ai_token_usage_ledger
        WHERE tenant_id=$1 AND cycle_id=$2`,
      [session.tenantId, entitlement.cycle.id]
    );
    return usageSummary(entitlement, requestCount.rows[0]?.count);
  });
}

async function assertBurstLimits(session, conversationId, runner) {
  const result = await runner.query(
    `SELECT
       count(*) FILTER (WHERE user_id=$2 AND status='reserved')::int AS "userConcurrent",
       count(*) FILTER (WHERE status='reserved')::int AS "tenantConcurrent",
       count(*) FILTER (WHERE conversation_id=$3 AND status='reserved')::int AS "conversationConcurrent",
       count(*) FILTER (WHERE user_id=$2 AND created_at>now()-interval '1 minute')::int AS "userPerMinute",
       count(*) FILTER (WHERE created_at>now()-interval '1 minute')::int AS "tenantPerMinute"
     FROM ai_token_reservations WHERE tenant_id=$1 AND created_at>now()-interval '15 minutes'`,
    [session.tenantId, session.userId, conversationId || null]
  );
  const counts = result.rows[0] || {};
  if (Number(counts.userConcurrent) >= 4 || Number(counts.tenantConcurrent) >= 20 ||
      Number(counts.conversationConcurrent) >= 2 || Number(counts.userPerMinute) >= 12 || Number(counts.tenantPerMinute) >= 120) {
    throw entitlementError("AI_BURST_LIMIT_REACHED", "توجد طلبات ذكاء كثيرة قيد التنفيذ. انتظر قليلًا ثم حاول مجددًا.", 429);
  }
}

export async function reserveAITokens(session, input = {}) {
  const requestedTokens = Math.max(128, safeInteger(input.requestedTokens));
  const minimumTokens = Math.max(128, Math.min(requestedTokens, safeInteger(input.minimumTokens) || 128));
  return transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [String(session.tenantId)]);
    await releaseExpiredReservations(session.tenantId, client);
    await assertBurstLimits(session, input.conversationId, client);
    const entitlement = await materializeEntitlement(session.tenantId, input.now || new Date(), client);
    const cycle = entitlement.cycle;
    const remaining = Math.max(0, Number(cycle.allowanceTokens) - Number(cycle.usedTokens) - Number(cycle.reservedTokens));
    if (remaining < minimumTokens) {
      const usage = usageSummary(entitlement);
      throw entitlementError("AI_PLAN_TOKEN_LIMIT_REACHED",
        "عذرًا، نفد رصيد الذكاء المتاح. تواصل مع الدعم أو رقِّ الباقة للمتابعة.", 429, { usage });
    }
    const reservedTokens = Math.min(requestedTokens, remaining);
    const inserted = await client.query(
      `INSERT INTO ai_token_reservations
        (tenant_id,user_id,conversation_id,cycle_id,requested_tokens,status,expires_at)
       VALUES($1,$2,$3,$4,$5,'reserved',now()+interval '15 minutes')
       RETURNING id,requested_tokens AS "reservedTokens",expires_at AS "expiresAt"`,
      [session.tenantId, session.userId, input.conversationId || null, cycle.id, reservedTokens]
    );
    await client.query(
      `UPDATE ai_entitlement_cycles SET reserved_tokens=reserved_tokens+$2,updated_at=now()
        WHERE id=$1 AND used_tokens+reserved_tokens+$2<=allowance_tokens`,
      [cycle.id, reservedTokens]
    );
    return { ...inserted.rows[0], cycleId: cycle.id, usage: usageSummary({ ...entitlement, cycle: { ...cycle, reservedTokens: Number(cycle.reservedTokens) + reservedTokens } }) };
  });
}

export async function settleAITokenReservation(session, reservationId, input = {}) {
  return transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [String(session.tenantId)]);
    const reservationResult = await client.query(
      `SELECT r.id,r.cycle_id AS "cycleId",r.requested_tokens AS "requestedTokens",r.status,r.provider_request_id AS "providerRequestId",
              c.allowance_tokens AS "allowanceTokens",c.used_tokens AS "usedTokens",c.reserved_tokens AS "reservedTokens",
              p.subscription_id AS "subscriptionId",p.quota_conversion_version AS "conversionVersion"
         FROM ai_token_reservations r JOIN ai_entitlement_cycles c ON c.id=r.cycle_id
         JOIN ai_entitlement_periods p ON p.id=c.entitlement_period_id
        WHERE r.id=$1 AND r.tenant_id=$2 AND r.user_id=$3 FOR UPDATE OF r,c`,
      [reservationId, session.tenantId, session.userId]
    );
    const reservation = reservationResult.rows[0];
    if (!reservation) throw entitlementError("AI_RESERVATION_NOT_FOUND", "حجز رصيد الذكاء غير موجود.", 404);
    if (reservation.status === "settled") {
      const existing = await client.query(
        `SELECT actual_tokens AS "actualTokens" FROM ai_token_usage_ledger WHERE reservation_id=$1 LIMIT 1`, [reservationId]
      );
      return { idempotent: true, actualTokens: Number(existing.rows[0]?.actualTokens || 0) };
    }
    if (reservation.status !== "reserved") return { idempotent: true, actualTokens: 0 };
    const usage = actualTokenUsage(input.usage);
    const providerRequestId = String(input.providerRequestId || reservationId).slice(0, 180);
    const idempotencyKey = String(input.idempotencyKey || `provider-request:${providerRequestId}`).slice(0, 220);
    const duplicate = await client.query(
      `SELECT quota_units_charged AS "actualTokens" FROM ai_provider_usage_ledger
        WHERE tenant_id=$1 AND provider='deepseek' AND (idempotency_key=$2 OR provider_request_id=$3) LIMIT 1`,
      [session.tenantId, idempotencyKey, providerRequestId]
    );
    if (duplicate.rows[0]) {
      await client.query(
        `UPDATE ai_entitlement_cycles SET reserved_tokens=GREATEST(0,reserved_tokens-$2),updated_at=now() WHERE id=$1`,
        [reservation.cycleId, reservation.requestedTokens]
      );
      await client.query(
        `UPDATE ai_token_reservations SET status='released',settled_at=now(),updated_at=now() WHERE id=$1`,
        [reservationId]
      );
      return { idempotent: true, actualTokens: Number(duplicate.rows[0].actualTokens) };
    }
    const availableAfterRelease = Number(reservation.allowanceTokens) - Number(reservation.usedTokens) -
      Math.max(0, Number(reservation.reservedTokens) - Number(reservation.requestedTokens));
    if (usage.actualTokens > availableAfterRelease) {
      throw entitlementError("AI_ACTUAL_USAGE_EXCEEDS_CYCLE", "تجاوز الاستخدام الفعلي سقف دورة الذكاء المحجوزة.", 409);
    }
    const costMicros = modelCostMicros(input.model, usage);
    await client.query(
      `UPDATE ai_entitlement_cycles SET used_tokens=used_tokens+$2,
         reserved_tokens=GREATEST(0,reserved_tokens-$3),updated_at=now() WHERE id=$1`,
      [reservation.cycleId, usage.actualTokens, reservation.requestedTokens]
    );
    await client.query(
      `UPDATE ai_token_reservations SET status='settled',actual_tokens=$2,provider_request_id=$3,
         settled_at=now(),updated_at=now() WHERE id=$1`,
      [reservationId, usage.actualTokens, providerRequestId]
    );
    await client.query(
      `INSERT INTO ai_token_usage_ledger
        (tenant_id,user_id,cycle_id,reservation_id,provider_request_id,model,routing_mode,input_tokens,output_tokens,
         cache_hit_tokens,cache_miss_tokens,actual_tokens,estimated_cost_micros)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [session.tenantId, session.userId, reservation.cycleId, reservationId, providerRequestId,
        String(input.model || "unknown"), String(input.routingMode || "flash"), usage.inputTokens, usage.outputTokens, usage.cacheHitTokens,
        usage.cacheMissTokens, usage.actualTokens, costMicros]
    );
    await client.query(
      `INSERT INTO ai_provider_usage_ledger
        (tenant_id,user_id,subscription_id,entitlement_cycle_id,reservation_id,provider,model,modality,
         native_usage_type,native_usage_amount,input_tokens,output_tokens,cached_tokens,total_tokens,
         actual_cost_usd,quota_conversion_version,quota_units_charged,provider_request_id,idempotency_key,
         pricing_snapshot,provider_usage_raw,status)
       VALUES($1,$2,$3,$4,$5,'deepseek',$6,'text','token',$7::numeric,$8,$9,$10,$7::bigint,$11,$12,$7::bigint,$13,$14,$15::jsonb,$16::jsonb,'confirmed')
       ON CONFLICT(tenant_id,provider,idempotency_key) DO NOTHING`,
      [session.tenantId, session.userId, reservation.subscriptionId, reservation.cycleId, reservationId,
        String(input.model || "unknown"), usage.actualTokens, usage.inputTokens, usage.outputTokens,
        usage.cacheHitTokens, costMicros / 1_000_000, reservation.conversionVersion, providerRequestId, idempotencyKey,
        JSON.stringify({ provider: "deepseek", model: String(input.model || "unknown"),
          conversionVersion: reservation.conversionVersion, quotaRule: "one_native_token_equals_one_renvix_quota_unit",
          costSource: "versioned_server_environment" }),
        JSON.stringify({ inputTokens: usage.inputTokens, outputTokens: usage.outputTokens,
          cacheHitTokens: usage.cacheHitTokens, cacheMissTokens: usage.cacheMissTokens,
          totalTokens: usage.actualTokens })]
    );
    await client.query(
      `INSERT INTO ai_cost_usage_daily
        (tenant_id,usage_date,model,request_count,actual_tokens,cache_hit_tokens,cache_miss_tokens,estimated_cost_micros)
       VALUES($1,CURRENT_DATE,$2,1,$3,$4,$5,$6)
       ON CONFLICT(tenant_id,usage_date,model) DO UPDATE SET
         request_count=ai_cost_usage_daily.request_count+1,
         actual_tokens=ai_cost_usage_daily.actual_tokens+EXCLUDED.actual_tokens,
         cache_hit_tokens=ai_cost_usage_daily.cache_hit_tokens+EXCLUDED.cache_hit_tokens,
         cache_miss_tokens=ai_cost_usage_daily.cache_miss_tokens+EXCLUDED.cache_miss_tokens,
         estimated_cost_micros=ai_cost_usage_daily.estimated_cost_micros+EXCLUDED.estimated_cost_micros`,
      [session.tenantId, String(input.model || "unknown"), usage.actualTokens, usage.cacheHitTokens, usage.cacheMissTokens, costMicros]
    );
    return { idempotent: false, ...usage, costMicros };
  });
}

export async function releaseAITokenReservation(session, reservationId) {
  return transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [String(session.tenantId)]);
    const result = await client.query(
      `UPDATE ai_token_reservations SET status='released',settled_at=now(),updated_at=now()
        WHERE id=$1 AND tenant_id=$2 AND user_id=$3 AND status='reserved'
        RETURNING cycle_id AS "cycleId",requested_tokens AS "requestedTokens"`,
      [reservationId, session.tenantId, session.userId]
    );
    if (!result.rows[0]) return { released: false };
    await client.query(
      `UPDATE ai_entitlement_cycles SET reserved_tokens=GREATEST(0,reserved_tokens-$2),updated_at=now() WHERE id=$1`,
      [result.rows[0].cycleId, result.rows[0].requestedTokens]
    );
    return { released: true };
  });
}

export async function applyAICostGuard(session, route) {
  const result = await query(
    `SELECT count(*)::bigint AS requests,
            count(*) FILTER (WHERE routing_mode='pro')::bigint AS "proRequests",
            count(*) FILTER (WHERE routing_mode='flash_thinking')::bigint AS "thinkingRequests",
            COALESCE(sum(estimated_cost_micros),0)::bigint AS "costMicros"
       FROM ai_token_usage_ledger WHERE tenant_id=$1 AND created_at>=date_trunc('month',now())`,
    [session.tenantId]
  );
  const row = result.rows[0] || {};
  const total = Number(row.requests || 0);
  const proShare = total ? Number(row.proRequests || 0) / total : 0;
  const thinkingShare = total ? Number(row.thinkingRequests || 0) / total : 0;
  const budget = safeInteger(process.env.AI_TENANT_MONTHLY_COST_GUARD_MICROS);
  const costExceeded = budget > 0 && Number(row.costMicros || 0) >= budget;
  if (route.modelTier === "pro" && (costExceeded || (total >= 20 && proShare >= 0.05))) {
    return Object.freeze({ ...route, modelTier: "flash", thinking: "enabled", reasoningEffort: "high", costGuardApplied: true });
  }
  if (route.modelTier === "flash" && route.thinking === "enabled" && total >= 20 && thinkingShare >= 0.12 && route.complexityScore < 51) {
    return Object.freeze({ ...route, thinking: "disabled", reasoningEffort: null, costGuardApplied: true });
  }
  return route;
}
