import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("AI token entitlement database and service contract", () => {
  const migration = readFileSync("drizzle/0079_ai_token_entitlements.sql", "utf8");
  const service = readFileSync("src/server/ai/entitlements.js", "utf8");
  const usage = readFileSync("src/server/ai/usage.js", "utf8");
  const orchestrator = readFileSync("src/server/ai/orchestrator.js", "utf8");
  const emailGenerationMigration = readFileSync("drizzle/0088_email_template_ai_generation.sql", "utf8");

  it("enforces four cycles, unique period-cycle numbering, and nonnegative balances in PostgreSQL", () => {
    expect(migration).toContain("CHECK (cycle_number BETWEEN 1 AND 4)");
    expect(migration).toContain("UNIQUE(entitlement_period_id,cycle_number)");
    expect(migration).toContain("CHECK (used_tokens + reserved_tokens <= allowance_tokens)");
    expect(migration).toContain("UNIQUE(tenant_id,provider_request_id)");
  });

  it("separates entitlement state from provider billing and keeps a cost-only admin ledger", () => {
    expect(migration).toContain("ai_entitlement_periods");
    expect(migration).toContain("ai_cost_usage_daily");
    expect(migration).toContain("independent from payment-provider implementation details");
    expect(service).toContain("estimated_cost_micros");
  });

  it("uses transactional tenant locking, reservations, actual response usage, and idempotent provider ids", () => {
    expect(service).toContain("pg_advisory_xact_lock");
    expect(service).toContain("SET LOCAL lock_timeout = '2500ms'");
    expect(service).toContain("SET LOCAL statement_timeout = '8000ms'");
    expect(service).toContain("AI_BURST_LIMIT_REACHED");
    expect(service).toContain("actualTokenUsage(input.usage)");
    expect(service).toContain("providerRequestId");
    expect(orchestrator).toContain("reserveAITokens");
    expect(orchestrator).toContain("settleAITokenReservation");
    expect(orchestrator).toContain("releaseAITokenReservation");
  });

  it("reads an existing balance without taking the entitlement writer lock", () => {
    expect(service).toContain("export async function getAIEntitlementSnapshot");
    expect(service).toContain("query_timeout: 2500");
    expect(usage).toContain("const snapshot = await getAIEntitlementSnapshot(session)");
    expect(usage).toContain("return snapshot || getAIEntitlementSummary(session)");
  });

  it("separates email-template tasks while retaining the unified entitlement and provider ledgers", () => {
    expect(emailGenerationMigration).toContain("email_template_code_generation");
    expect(emailGenerationMigration).toContain("email_template_code_edit");
    expect(emailGenerationMigration).toContain("ai_token_usage_ledger ADD COLUMN IF NOT EXISTS task_type");
    expect(emailGenerationMigration).toContain("ai_provider_usage_ledger ADD COLUMN IF NOT EXISTS task_type");
  });
});
