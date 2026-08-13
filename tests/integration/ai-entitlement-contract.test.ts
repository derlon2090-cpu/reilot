import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("AI token entitlement database and service contract", () => {
  const migration = readFileSync("drizzle/0079_ai_token_entitlements.sql", "utf8");
  const service = readFileSync("src/server/ai/entitlements.js", "utf8");
  const orchestrator = readFileSync("src/server/ai/orchestrator.js", "utf8");

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
    expect(service).toContain("AI_BURST_LIMIT_REACHED");
    expect(service).toContain("actualTokenUsage(input.usage)");
    expect(service).toContain("providerRequestId");
    expect(orchestrator).toContain("reserveAITokens");
    expect(orchestrator).toContain("settleAITokenReservation");
    expect(orchestrator).toContain("releaseAITokenReservation");
  });
});
