import crypto from "node:crypto";
import { query, transaction } from "../db.js";
import { reserveAITokens, releaseAITokenReservation } from "./entitlements.js";

const safeInteger = (value) => Math.max(0, Math.floor(Number(value || 0)));
const safeDecimal = (value) => Math.max(0, Number(value || 0));

export function normalizeGeminiUsage(metadata = {}) {
  const inputTokens = safeInteger(metadata.promptTokenCount ?? metadata.total_input_tokens);
  const outputTokens = safeInteger(metadata.candidatesTokenCount ?? metadata.responseTokenCount ?? metadata.total_output_tokens);
  const thoughtTokens = safeInteger(metadata.thoughtsTokenCount ?? metadata.total_thought_tokens);
  const cachedTokens = safeInteger(metadata.cachedContentTokenCount ?? metadata.total_cached_tokens);
  const totalTokens = safeInteger(metadata.totalTokenCount ?? metadata.total_tokens) || inputTokens + outputTokens + thoughtTokens;
  const promptDetails = Array.isArray(metadata.promptTokensDetails)
    ? metadata.promptTokensDetails
    : Array.isArray(metadata.input_tokens_by_modality) ? metadata.input_tokens_by_modality : [];
  const modalityTokens = (name) => promptDetails
    .filter((item) => String(item?.modality || "").toLowerCase() === name)
    .reduce((sum, item) => sum + safeInteger(item.tokenCount ?? item.tokens), 0);
  return Object.freeze({
    inputTokens,
    outputTokens,
    thoughtTokens,
    cachedTokens,
    totalTokens,
    imageInputTokens: modalityTokens("image"),
    textInputTokens: modalityTokens("text")
  });
}

export function normalizeDeepgramUsage(payload = {}, options = {}) {
  const metadata = payload.metadata || {};
  return Object.freeze({
    durationSeconds: safeDecimal(metadata.duration),
    channels: Math.max(1, safeInteger(metadata.channels) || safeInteger(payload.results?.channels?.length) || 1),
    model: String(options.model || "nova-3"),
    language: String(options.language || ""),
    mode: "prerecorded",
    multilingual: options.language === "multi",
    keytermUsed: Array.isArray(options.keyterm) && options.keyterm.length > 0,
    diarizationUsed: Boolean(options.diarize),
    providerRequestId: String(metadata.request_id || metadata.transaction_key || "")
  });
}

export function nativeAmounts(provider, usage = {}) {
  if (provider === "gemini") {
    return {
      input_token: Math.max(0, safeInteger(usage.inputTokens) - safeInteger(usage.cachedTokens)),
      output_token: safeInteger(usage.outputTokens),
      thought_token: safeInteger(usage.thoughtTokens),
      cached_input_token: safeInteger(usage.cachedTokens)
    };
  }
  if (provider === "deepgram") {
    const multiplier = Math.max(1, safeInteger(usage.channels) || 1);
    return {
      audio_second: safeDecimal(usage.durationSeconds) * multiplier,
      keyterm_audio_second: usage.keytermUsed ? safeDecimal(usage.durationSeconds) * multiplier : 0
    };
  }
  return {};
}

export function calculateProviderCost(provider, usage, pricingRows = []) {
  const amounts = nativeAmounts(provider, usage);
  const components = [];
  let actualCostUsd = 0;
  for (const row of pricingRows) {
    const amount = safeDecimal(amounts[row.usageType]);
    if (!amount) continue;
    const unitPriceUsd = safeDecimal(row.pricePerUnitUsd);
    const costUsd = amount * unitPriceUsd;
    actualCostUsd += costUsd;
    components.push({
      usageType: row.usageType,
      nativeUnit: row.nativeUnit,
      nativeAmount: amount,
      unitPriceUsd,
      costUsd,
      pricingVersion: row.pricingVersion,
      variant: row.variant
    });
  }
  return Object.freeze({ actualCostUsd, components: Object.freeze(components) });
}

export function quotaUnitsForCost(actualCostUsd, referenceCostPerQuotaUnitUsd) {
  const reference = safeDecimal(referenceCostPerQuotaUnitUsd);
  if (!reference) throw Object.assign(new Error("نسخة تحويل رصيد الذكاء غير مهيأة."), { code: "AI_QUOTA_CONVERSION_MISSING", status: 503 });
  const rawUnits = safeDecimal(actualCostUsd) / reference;
  // Provider decimal prices are exact in PostgreSQL but become binary floats
  // in JavaScript. Remove only sub-nanounit representation noise at integers.
  const nearestInteger = Math.round(rawUnits);
  if (Math.abs(rawUnits - nearestInteger) < 1e-9) return Math.max(0, nearestInteger);
  return Math.max(0, Math.ceil(rawUnits));
}

function usageRaw(provider, usage) {
  if (provider === "gemini") return {
    inputTokens: safeInteger(usage.inputTokens), outputTokens: safeInteger(usage.outputTokens),
    thoughtTokens: safeInteger(usage.thoughtTokens), cachedTokens: safeInteger(usage.cachedTokens),
    totalTokens: safeInteger(usage.totalTokens), imageInputTokens: safeInteger(usage.imageInputTokens),
    textInputTokens: safeInteger(usage.textInputTokens)
  };
  if (provider === "deepgram") return {
    durationSeconds: safeDecimal(usage.durationSeconds), channels: Math.max(1, safeInteger(usage.channels) || 1),
    mode: "prerecorded", multilingual: Boolean(usage.multilingual), keytermUsed: Boolean(usage.keytermUsed),
    diarizationUsed: Boolean(usage.diarizationUsed), language: String(usage.language || "").slice(0, 16)
  };
  return {};
}

async function activePricing(runner, provider, model, variant, at = new Date()) {
  const result = await runner.query(
    `SELECT usage_type AS "usageType",native_unit AS "nativeUnit",variant,
            price_per_unit_usd AS "pricePerUnitUsd",pricing_version AS "pricingVersion"
       FROM ai_provider_pricing
      WHERE provider=$1 AND model=$2 AND variant=$3 AND approval_status='approved' AND valid_from<=$4
        AND (valid_until IS NULL OR valid_until>$4)
      ORDER BY usage_type`,
    [provider, model, variant, at]
  );
  if (!result.rows.length) {
    throw Object.assign(new Error("تسعير مزود الوسائط غير مهيأ لهذا النموذج."), {
      code: "AI_PROVIDER_PRICING_MISSING", status: 503
    });
  }
  return result.rows;
}

export async function createAIRun(session, { conversationId = null, messageId = null, taskType = "chat" } = {}) {
  const result = await query(
    `INSERT INTO ai_runs(tenant_id,user_id,conversation_id,message_id,task_type)
     VALUES($1,$2,$3,$4,$5) RETURNING id,status,task_type AS "taskType",created_at AS "createdAt"`,
    [session.tenantId, session.userId, conversationId, messageId, String(taskType || "chat").slice(0, 80)]
  );
  return result.rows[0];
}

export async function finishAIRun(session, aiRunId, { status = "completed" } = {}) {
  const safeStatus = status === "completed" ? "completed" : "failed";
  const result = await query(
    `UPDATE ai_runs SET status=$3,completed_at=now()
      WHERE id=$1 AND tenant_id=$2 AND status='processing'
      RETURNING id,status,completed_at AS "completedAt"`,
    [aiRunId, session.tenantId, safeStatus]
  );
  return result.rows[0] || null;
}

export async function reserveProviderQuota(session, input) {
  const variant = String(input.variant || "standard");
  const rows = await activePricing({ query }, input.provider, input.model, variant, input.now || new Date());
  const estimated = calculateProviderCost(input.provider, input.estimatedUsage || {}, rows);
  const conversion = await query(
    `SELECT q.reference_cost_per_quota_unit_usd AS "referenceCost"
       FROM ai_entitlement_periods p JOIN quota_conversion_versions q ON q.version=p.quota_conversion_version
      WHERE p.tenant_id=$1 AND p.status='active' AND p.period_start<=$2 AND p.period_end>$2
      ORDER BY p.created_at DESC LIMIT 1`,
    [session.tenantId, input.now || new Date()]
  );
  const estimatedQuotaUnits = quotaUnitsForCost(estimated.actualCostUsd, conversion.rows[0]?.referenceCost);
  const reservation = await reserveAITokens(session, {
    conversationId: input.conversationId,
    requestedTokens: Math.max(128, estimatedQuotaUnits),
    minimumTokens: Math.max(128, Math.min(estimatedQuotaUnits || 128, 1024)),
    now: input.now
  });
  return { ...reservation, estimatedQuotaUnits, pricingVersion: rows[0]?.pricingVersion };
}

export async function settleProviderUsage(session, reservationId, input) {
  const provider = String(input.provider || "");
  const model = String(input.model || "");
  const variant = String(input.variant || "standard");
  const providerRequestId = String(input.providerRequestId || crypto.randomUUID()).slice(0, 180);
  const idempotencyKey = String(input.idempotencyKey || `provider-request:${providerRequestId}`).slice(0, 220);
  const confirmed = input.confirmed !== false;
  return transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [String(session.tenantId)]);
    const reservationResult = await client.query(
      `SELECT r.id,r.cycle_id AS "cycleId",r.requested_tokens AS "requestedTokens",r.status,
              c.allowance_tokens AS "allowanceTokens",c.used_tokens AS "usedTokens",c.reserved_tokens AS "reservedTokens",
              p.subscription_id AS "subscriptionId",p.quota_conversion_version AS "conversionVersion",
              q.reference_cost_per_quota_unit_usd AS "referenceCost"
         FROM ai_token_reservations r
         JOIN ai_entitlement_cycles c ON c.id=r.cycle_id
         JOIN ai_entitlement_periods p ON p.id=c.entitlement_period_id
         JOIN quota_conversion_versions q ON q.version=p.quota_conversion_version
        WHERE r.id=$1 AND r.tenant_id=$2 AND r.user_id=$3 FOR UPDATE OF r,c`,
      [reservationId, session.tenantId, session.userId]
    );
    const reservation = reservationResult.rows[0];
    if (!reservation) throw Object.assign(new Error("حجز رصيد الذكاء غير موجود."), { code: "AI_RESERVATION_NOT_FOUND", status: 404 });
    const duplicate = await client.query(
      `SELECT quota_units_charged AS "quotaUnits" FROM ai_provider_usage_ledger
        WHERE tenant_id=$1 AND provider=$2 AND (idempotency_key=$3 OR provider_request_id=$4) LIMIT 1`,
      [session.tenantId, provider, idempotencyKey, providerRequestId]
    );
    if (duplicate.rows[0]) {
      if (reservation.status === "reserved") {
        await client.query(`UPDATE ai_entitlement_cycles SET reserved_tokens=GREATEST(0,reserved_tokens-$2),updated_at=now() WHERE id=$1`,
          [reservation.cycleId, reservation.requestedTokens]);
        await client.query(`UPDATE ai_token_reservations SET status='released',settled_at=now(),updated_at=now() WHERE id=$1`, [reservationId]);
      }
      return { idempotent: true, quotaUnitsCharged: Number(duplicate.rows[0].quotaUnits) };
    }
    if (reservation.status !== "reserved") return { idempotent: true, quotaUnitsCharged: 0 };
    const pricingRows = await activePricing(client, provider, model, variant, input.now || new Date());
    const cost = calculateProviderCost(provider, input.usage || {}, pricingRows);
    const quotaUnitsCharged = confirmed ? quotaUnitsForCost(cost.actualCostUsd, reservation.referenceCost) : 0;
    const availableAfterRelease = Number(reservation.allowanceTokens) - Number(reservation.usedTokens)
      - Math.max(0, Number(reservation.reservedTokens) - Number(reservation.requestedTokens));
    if (quotaUnitsCharged > availableAfterRelease) {
      throw Object.assign(new Error("تجاوز الاستخدام الفعلي رصيد دورة الذكاء المتاح."), { code: "AI_ACTUAL_USAGE_EXCEEDS_CYCLE", status: 409 });
    }
    await client.query(
      `UPDATE ai_entitlement_cycles SET used_tokens=used_tokens+$2,
         reserved_tokens=GREATEST(0,reserved_tokens-$3),updated_at=now() WHERE id=$1`,
      [reservation.cycleId, quotaUnitsCharged, reservation.requestedTokens]
    );
    await client.query(
      `UPDATE ai_token_reservations SET status='settled',actual_tokens=$2,provider_request_id=$3,
         settled_at=now(),updated_at=now() WHERE id=$1`,
      [reservationId, quotaUnitsCharged, `${provider}:${providerRequestId}`.slice(0, 180)]
    );
    const native = nativeAmounts(provider, input.usage || {});
    const nativeUsageAmount = provider === "deepgram"
      ? safeDecimal(input.usage?.durationSeconds)
      : safeInteger(input.usage?.totalTokens);
    await client.query(
      `INSERT INTO ai_provider_usage_ledger
        (tenant_id,user_id,subscription_id,entitlement_cycle_id,ai_run_id,attachment_id,reservation_id,
         provider,model,modality,native_usage_type,native_usage_amount,input_tokens,output_tokens,thought_tokens,
         cached_tokens,total_tokens,audio_duration_seconds,audio_channels,image_count,actual_cost_usd,
         quota_conversion_version,quota_units_charged,provider_request_id,idempotency_key,pricing_snapshot,provider_usage_raw,status,
         language,fallback_used,processing_latency_ms,confidence)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26::jsonb,$27::jsonb,$28,$29,$30,$31,$32)`,
      [session.tenantId, session.userId, reservation.subscriptionId, reservation.cycleId, input.aiRunId || null,
        input.attachmentId || null, reservationId, provider, model, input.modality, provider === "deepgram" ? "audio_second" : "token",
        nativeUsageAmount, input.usage?.inputTokens ?? null, input.usage?.outputTokens ?? null,
        input.usage?.thoughtTokens ?? null, input.usage?.cachedTokens ?? null, input.usage?.totalTokens ?? null,
        input.usage?.durationSeconds ?? null, input.usage?.channels ?? null, input.imageCount || null,
        confirmed ? cost.actualCostUsd : null, reservation.conversionVersion, quotaUnitsCharged, providerRequestId, idempotencyKey,
        JSON.stringify({ provider, model, variant, components: cost.components, conversionVersion: reservation.conversionVersion,
          referenceCostPerQuotaUnitUsd: Number(reservation.referenceCost) }), JSON.stringify(usageRaw(provider, input.usage || {})),
        confirmed ? "confirmed" : "unconfirmed", input.language || null, Boolean(input.fallbackUsed),
        safeInteger(input.processingLatencyMs), input.confidence == null ? null : Math.max(0, Math.min(1, Number(input.confidence)))]
    );
    if (input.aiRunId) {
      await client.query(
        `UPDATE ai_runs SET total_quota_units=total_quota_units+$2,status=$3,
           completed_at=CASE WHEN $3='completed' THEN now() ELSE completed_at END WHERE id=$1 AND tenant_id=$4`,
        [input.aiRunId, quotaUnitsCharged, input.completeRun ? "completed" : "processing", session.tenantId]
      );
    }
    return { idempotent: false, actualCostUsd: confirmed ? cost.actualCostUsd : null, quotaUnitsCharged,
      pricingSnapshot: cost.components, nativeUsage: native };
  });
}

export async function releaseProviderQuota(session, reservationId) {
  return releaseAITokenReservation(session, reservationId);
}

export async function getAIProviderUsageSummary({ tenantId = null, days = 30 } = {}) {
  const result = await query(
    `SELECT provider,model,modality,status,count(*)::int AS requests,
            COALESCE(sum(native_usage_amount),0)::numeric AS "nativeUsage",
            COALESCE(sum(actual_cost_usd) FILTER (WHERE status='confirmed'),0)::numeric AS "confirmedCostUsd",
            COALESCE(sum(quota_units_charged),0)::bigint AS "quotaUnits",
            COALESCE(sum(total_tokens),0)::bigint AS "totalTokens",
            COALESCE(sum(audio_duration_seconds),0)::numeric AS "audioDurationSeconds",
            COALESCE(sum(image_count),0)::bigint AS "imageCount"
       FROM ai_provider_usage_ledger
      WHERE created_at>=now()-($1::int*interval '1 day') AND ($2::uuid IS NULL OR tenant_id=$2)
      GROUP BY provider,model,modality,status ORDER BY provider,model,modality,status`,
    [Math.max(1, Math.min(366, Number(days || 30))), tenantId]
  );
  return result.rows.map((row) => ({
    ...row,
    requests: Number(row.requests || 0),
    nativeUsage: Number(row.nativeUsage || 0),
    confirmedCostUsd: Number(row.confirmedCostUsd || 0),
    quotaUnits: Number(row.quotaUnits || 0),
    totalTokens: Number(row.totalTokens || 0),
    audioDurationSeconds: Number(row.audioDurationSeconds || 0),
    imageCount: Number(row.imageCount || 0)
  }));
}

export async function reconcileAIProviderUsage() {
  let unconfirmed;
  try {
    unconfirmed = await query(
      `SELECT provider,count(*)::int AS count,min(created_at) AS "oldestAt"
         FROM ai_provider_usage_ledger WHERE status='unconfirmed' GROUP BY provider ORDER BY provider`
    );
  } catch (error) {
    if (error?.code === "42P01") return { ready: false, reason: "schema_not_applied" };
    throw error;
  }
  const staleRuns = await query(
    `UPDATE ai_runs SET status='failed',completed_at=now()
      WHERE status='processing' AND created_at<now()-interval '30 minutes' RETURNING id`
  );
  const orphanReservations = await query(
    `SELECT count(*)::int AS count FROM ai_token_reservations r
      WHERE r.status='settled' AND NOT EXISTS (
        SELECT 1 FROM ai_provider_usage_ledger ledger WHERE ledger.reservation_id=r.id
      )`
  );
  const pricingAlerts = await getAIProviderPricingAlerts();
  return {
    ready: true,
    unconfirmed: unconfirmed.rows,
    staleRunsClosed: staleRuns.rowCount,
    settledReservationsMissingUnifiedLedger: Number(orphanReservations.rows[0]?.count || 0),
    pricingAlerts
  };
}

export async function getAIProviderPricingAlerts(at = new Date()) {
  try {
    const result = await query(
      `WITH configured(provider,model,variant) AS (
         SELECT DISTINCT provider,model,variant FROM ai_provider_pricing
       )
       SELECT configured.provider,configured.model,configured.variant,
              NOT EXISTS (
                SELECT 1 FROM ai_provider_pricing active
                 WHERE active.provider=configured.provider AND active.model=configured.model
                   AND active.variant=configured.variant AND active.approval_status='approved'
                   AND active.valid_from<=$1 AND (active.valid_until IS NULL OR active.valid_until>$1)
              ) AS "missingApprovedPrice",
              COALESCE((
                SELECT count(*)::int FROM ai_provider_pricing draft
                 WHERE draft.provider=configured.provider AND draft.model=configured.model
                   AND draft.variant=configured.variant AND draft.approval_status='draft'
                   AND draft.valid_from<=$1
              ),0) AS "dueDrafts"
         FROM configured
        ORDER BY configured.provider,configured.model,configured.variant`,
      [at]
    );
    return result.rows.filter((row) => row.missingApprovedPrice || Number(row.dueDrafts || 0) > 0)
      .map((row) => ({ ...row, dueDrafts: Number(row.dueDrafts || 0) }));
  } catch (error) {
    if (["42P01", "42703"].includes(error?.code)) return [{ reason: "pricing_approval_schema_not_applied" }];
    throw error;
  }
}
