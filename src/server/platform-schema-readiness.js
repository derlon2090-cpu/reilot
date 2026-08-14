import { query } from "./db.js";

export const REQUIRED_PLATFORM_MIGRATION = "0087_ai_attachment_storage_reconciliation.sql";

const REQUIRED_COLUMNS = [
  "ai_attachments.deletion_completed_at",
  "ai_attachments.deletion_requested_at",
  "ai_attachments.derived_object_keys",
  "ai_attachments.processing_generation",
  "ai_provider_pricing.approval_status",
  "ai_provider_usage_ledger.idempotency_key"
];

export async function platformSchemaHealth() {
  const result = await query(
    `SELECT
       EXISTS (SELECT 1 FROM schema_migrations WHERE name = $1) AS migration_applied,
       to_regclass('public.ai_attachments') IS NOT NULL AS attachments_table,
       to_regclass('public.ai_provider_usage_ledger') IS NOT NULL AS provider_ledger_table,
       to_regclass('public.attachment_deletion_tombstones') IS NOT NULL AS deletion_tombstones_table,
       EXISTS (
         SELECT 1 FROM pg_trigger
          WHERE tgname = 'renvix_tenant_storage_usage_trigger' AND NOT tgisinternal
       ) AS storage_trigger_ready,
       COALESCE(array_agg(table_name || '.' || column_name)
         FILTER (WHERE table_name IS NOT NULL), ARRAY[]::text[]) AS available_columns
     FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (
        (table_name = 'ai_attachments' AND column_name IN (
          'deletion_completed_at','deletion_requested_at','derived_object_keys','processing_generation'
        ))
        OR (table_name = 'ai_provider_pricing' AND column_name = 'approval_status')
        OR (table_name = 'ai_provider_usage_ledger' AND column_name = 'idempotency_key')
      )`,
    [REQUIRED_PLATFORM_MIGRATION]
  );
  const row = result.rows[0] || {};
  const available = new Set(row.available_columns || []);
  const missingColumns = REQUIRED_COLUMNS.filter((column) => !available.has(column));
  const ok = row.migration_applied === true
    && row.attachments_table === true
    && row.provider_ledger_table === true
    && row.deletion_tombstones_table === true
    && row.storage_trigger_ready === true
    && missingColumns.length === 0;
  return {
    ok,
    migration: REQUIRED_PLATFORM_MIGRATION,
    migrationApplied: row.migration_applied === true,
    attachmentsTable: row.attachments_table === true,
    providerLedgerTable: row.provider_ledger_table === true,
    deletionTombstonesTable: row.deletion_tombstones_table === true,
    storageTriggerReady: row.storage_trigger_ready === true,
    missingColumns
  };
}
