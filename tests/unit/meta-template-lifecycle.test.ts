import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const service = readFileSync("src/server/meta-template-service.js", "utf8");
const route = readFileSync("app/api/whatsapp/templates/[id]/route.js", "utf8");
const migration = readFileSync("drizzle/0037_meta_template_lifecycle.sql", "utf8");
const statusMigration = readFileSync("drizzle/0096_meta_template_status_expansion.sql", "utf8");
const productionEnv = readFileSync(".env.production.example", "utf8");
const schemaGate = readFileSync("src/server/meta-template-schema.js", "utf8");

describe("Meta WhatsApp template lifecycle", () => {
  it("keeps Meta identity tenant and WABA scoped", () => {
    expect(migration).toContain("waba_id text");
    expect(migration).toContain("meta_message_templates_waba_meta_unique");
    expect(migration).toContain("meta_message_templates_waba_name_language_unique");
    expect(service).toContain("WHERE tenant_id=$1 AND meta_integration_id=$2");
  });

  it("paginates, upserts and reports a truthful synchronization summary", () => {
    expect(service).toContain("async function listAllGraphTemplates");
    expect(service).toContain("payload?.paging?.cursors?.after");
    expect(service).toContain("async function upsertSyncedTemplate");
    expect(service).toContain("added: 0, updated: 0, unchanged: 0");
    expect(service).toContain("MISSING_FROM_META");
  });

  it("deletes through the server and keeps an audit record", () => {
    expect(route).toContain("export async function DELETE");
    expect(route).toContain("deleteMetaTemplate");
    expect(service).toContain("export async function deleteMetaTemplate");
    expect(service).toContain("meta_template.deleted");
    expect(service).toContain("local_status='pending_deletion'");
  });

  it("never treats an unknown Meta status as approved", () => {
    expect(service).toContain('if (normalized === "APPROVED") return "approved"');
    expect(service).toContain('if (normalized === "FLAGGED") return "flagged"');
    expect(service).toContain('if (normalized === "IN_APPEAL") return "in_appeal"');
    expect(service).toContain('return "unknown"');
    expect(statusMigration).toContain("'flagged','in_appeal'");
    expect(statusMigration).toContain("last_meta_event jsonb");
    expect(service).toContain('"whatsapp_template.approved"');
    expect(service).toContain('"whatsapp_template.rejected"');
  });

  it("allows incomplete local drafts but requires safe variable examples before Meta submission", () => {
    expect(service).toContain("function assertMetaSubmissionExamples(components)");
    expect(service).toContain("assertMetaSubmissionExamples(row.components)");
    expect(service).toContain("META_TEMPLATE_EXAMPLES_REQUIRED");
  });

  it("documents the required production Meta configuration without embedding secrets", () => {
    expect(productionEnv).toContain("META_GRAPH_VERSION=");
    expect(productionEnv).toContain("META_GRAPH_BASE_URL=https://graph.facebook.com");
    expect(productionEnv).toContain("META_WEBHOOK_VERIFY_TOKEN=");
    expect(productionEnv).toContain("META_WEBHOOK_APP_SECRET=");
  });

  it("gates every production code path on the idempotent migration when Actions is unavailable", () => {
    expect(schemaGate).toContain('const META_TEMPLATE_MIGRATION_NAME = "0096_meta_template_status_expansion.sql"');
    expect(schemaGate).toContain("runMigrationPlan(client");
    expect(schemaGate).toContain("let schemaReadyPromise");
    expect(service.match(/await ensureMetaTemplateSchema\(\);/g)?.length).toBeGreaterThanOrEqual(7);
  });
});
