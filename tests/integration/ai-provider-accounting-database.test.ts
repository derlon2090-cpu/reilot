import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { query } from "../../src/server/db.js";
import { getAIEntitlementSummary } from "../../src/server/ai/entitlements.js";
import { reserveProviderQuota, settleProviderUsage } from "../../src/server/ai/provider-accounting.js";

const tenantId = crypto.randomUUID();
const userId = crypto.randomUUID();
const subscriptionId = crypto.randomUUID();
const session = { tenantId, userId };

describe.sequential("provider-native PostgreSQL accounting", () => {
  beforeAll(async () => {
    const plan = await query("SELECT id FROM platform_plans WHERE slug='professional' LIMIT 1");
    await query("INSERT INTO tenants(id,name,slug,status) VALUES($1,'Provider accounting test',$2,'active')", [tenantId, `provider-${tenantId}`]);
    await query(
      "INSERT INTO users(id,tenant_id,name,email,email_verified,role) VALUES($1,$2,'Provider Test',$3,true,'owner')",
      [userId, tenantId, `provider-${userId}@example.test`]
    );
    await query(
      `INSERT INTO platform_subscriptions(id,tenant_id,plan_id,status,billing_cycle,current_period_start,current_period_end)
       VALUES($1,$2,$3,'active','monthly',now()-interval '1 day',now()+interval '30 days')`,
      [subscriptionId, tenantId, plan.rows[0].id]
    );
    await getAIEntitlementSummary(session);
  });

  afterAll(async () => {
    await query("DELETE FROM users WHERE id=$1", [userId]);
    await query("DELETE FROM tenant_storage_usage WHERE tenant_id=$1", [tenantId]);
    await query("DELETE FROM tenants WHERE id=$1", [tenantId]);
  }, 30_000);

  it("settles Gemini from actual usageMetadata-equivalent tokens and deduplicates request ids", async () => {
    const reservation = await reserveProviderQuota(session, {
      provider: "gemini", model: "gemini-3.6-flash", variant: "standard",
      estimatedUsage: { inputTokens: 1_000, outputTokens: 500, thoughtTokens: 0, totalTokens: 1_500 }
    });
    const settled = await settleProviderUsage(session, reservation.id, {
      provider: "gemini", model: "gemini-3.6-flash", variant: "standard", modality: "vision",
      usage: { inputTokens: 800, outputTokens: 100, thoughtTokens: 20, cachedTokens: 200, totalTokens: 920 },
      confirmed: true, providerRequestId: "gemini-db-request-1", idempotencyKey: "vision-operation-1", imageCount: 1
    });
    expect(settled.actualCostUsd).toBeCloseTo(0.000915, 10);
    expect(settled.quotaUnitsCharged).toBe(915);

    const duplicateReservation = await reserveProviderQuota(session, {
      provider: "gemini", model: "gemini-3.6-flash", variant: "standard",
      estimatedUsage: { inputTokens: 1_000, outputTokens: 500, totalTokens: 1_500 }
    });
    const duplicate = await settleProviderUsage(session, duplicateReservation.id, {
      provider: "gemini", model: "gemini-3.6-flash", variant: "standard", modality: "vision",
      usage: { inputTokens: 800, outputTokens: 100, thoughtTokens: 20, cachedTokens: 200, totalTokens: 920 },
      confirmed: true, providerRequestId: "gemini-db-request-2", idempotencyKey: "vision-operation-1", imageCount: 1
    });
    expect(duplicate).toMatchObject({ idempotent: true, quotaUnitsCharged: 915 });
    const ledger = await query(
      "SELECT count(*)::int AS count FROM ai_provider_usage_ledger WHERE provider='gemini' AND idempotency_key=$1",
      ["vision-operation-1"]
    );
    expect(ledger.rows[0].count).toBe(1);
  });

  it("does not activate a future draft price merely because its effective date arrived", async () => {
    const draft = await query(
      `SELECT approval_status AS status FROM ai_provider_pricing
        WHERE provider='gemini' AND pricing_version='google-2027-v1' LIMIT 1`
    );
    expect(draft.rows[0]?.status).toBe("draft");
    await expect(reserveProviderQuota(session, {
      provider: "gemini", model: "gemini-3.6-flash", variant: "standard",
      estimatedUsage: { inputTokens: 1_000, outputTokens: 100, totalTokens: 1_100 },
      now: new Date("2027-02-01T00:00:00Z")
    })).rejects.toMatchObject({ code: "AI_PROVIDER_PRICING_MISSING", status: 503 });
  });

  it("settles Deepgram by provider duration and channels", async () => {
    const reservation = await reserveProviderQuota(session, {
      provider: "deepgram", model: "nova-3", variant: "mip_opt_out",
      estimatedUsage: { durationSeconds: 10, channels: 2, keytermUsed: true }
    });
    const settled = await settleProviderUsage(session, reservation.id, {
      provider: "deepgram", model: "nova-3", variant: "mip_opt_out", modality: "audio",
      usage: { durationSeconds: 10, channels: 2, keytermUsed: true }, confirmed: true,
      providerRequestId: "deepgram-db-request-1", language: "ar-SA", confidence: 0.91
    });
    expect(settled.actualCostUsd).toBeCloseTo(0.003, 9);
    expect(settled.quotaUnitsCharged).toBe(3000);
    const ledger = await query(
      `SELECT audio_duration_seconds AS duration,audio_channels AS channels,status,actual_cost_usd AS cost
         FROM ai_provider_usage_ledger WHERE provider_request_id=$1`, ["deepgram-db-request-1"]
    );
    expect(Number(ledger.rows[0].duration)).toBe(10);
    expect(ledger.rows[0].channels).toBe(2);
    expect(ledger.rows[0].status).toBe("confirmed");
  });

  it("records missing provider usage as unconfirmed and never presents it as actual cost", async () => {
    const reservation = await reserveProviderQuota(session, {
      provider: "deepgram", model: "nova-3", variant: "mip_opt_out",
      estimatedUsage: { durationSeconds: 30, channels: 1, keytermUsed: true }
    });
    const settled = await settleProviderUsage(session, reservation.id, {
      provider: "deepgram", model: "nova-3", variant: "mip_opt_out", modality: "audio",
      usage: { durationSeconds: 30, channels: 1, keytermUsed: true }, confirmed: false,
      providerRequestId: "deepgram-unconfirmed-1"
    });
    expect(settled).toMatchObject({ actualCostUsd: null, quotaUnitsCharged: 0 });
    const ledger = await query(
      `SELECT status,actual_cost_usd AS cost,quota_units_charged AS quota
         FROM ai_provider_usage_ledger WHERE provider_request_id=$1`, ["deepgram-unconfirmed-1"]
    );
    expect(ledger.rows[0]).toMatchObject({ status: "unconfirmed", cost: null, quota: "0" });
  });
});
