import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/server/db.js", () => ({ query: vi.fn() }));
import { query } from "../../src/server/db.js";
import { platformSchemaHealth, REQUIRED_PLATFORM_MIGRATION } from "../../src/server/platform-schema-readiness.js";

const requiredColumns = [
  "ai_attachments.deletion_completed_at",
  "ai_attachments.deletion_requested_at",
  "ai_attachments.derived_object_keys",
  "ai_attachments.processing_generation",
  "ai_provider_pricing.approval_status",
  "ai_provider_usage_ledger.idempotency_key",
  "ai_provider_usage_ledger.task_type",
  "ai_token_usage_ledger.ai_run_id",
  "ai_token_usage_ledger.task_type",
  "ai_runs.task_type",
  "ai_email_template_generations.result_json"
];

describe("platform database schema readiness", () => {
  beforeEach(() => vi.mocked(query).mockReset());

  it("accepts the complete attachment, accounting, and hard-delete schema", async () => {
    vi.mocked(query).mockResolvedValue({ rows: [{
      migration_applied: true,
      attachments_table: true,
      provider_ledger_table: true,
      email_template_generations_table: true,
      campaign_copy_generations_table: true,
      deletion_tombstones_table: true,
      storage_trigger_ready: true,
      available_columns: requiredColumns
    }] } as never);
    await expect(platformSchemaHealth()).resolves.toMatchObject({
      ok: true,
      migration: REQUIRED_PLATFORM_MIGRATION,
      migrationApplied: true,
      storageTriggerReady: true,
      missingColumns: []
    });
  });

  it("fails closed when a migration, table, trigger, or required column is absent", async () => {
    vi.mocked(query).mockResolvedValue({ rows: [{
      migration_applied: false,
      attachments_table: true,
      provider_ledger_table: false,
      email_template_generations_table: false,
      campaign_copy_generations_table: false,
      deletion_tombstones_table: false,
      storage_trigger_ready: false,
      available_columns: requiredColumns.slice(0, -1)
    }] } as never);
    const result = await platformSchemaHealth();
    expect(result.ok).toBe(false);
    expect(result.migrationApplied).toBe(false);
    expect(result.providerLedgerTable).toBe(false);
    expect(result.missingColumns).toEqual(["ai_email_template_generations.result_json"]);
  });
});
