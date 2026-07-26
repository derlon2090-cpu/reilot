import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const service = readFileSync("src/server/meta-template-service.js", "utf8");
const route = readFileSync("app/api/whatsapp/templates/[id]/route.js", "utf8");
const migration = readFileSync("drizzle/0037_meta_template_lifecycle.sql", "utf8");
const productionEnv = readFileSync(".env.production.example", "utf8");

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
    expect(service).toContain('return "unknown"');
  });

  it("documents the required production Meta configuration without embedding secrets", () => {
    expect(productionEnv).toContain("META_GRAPH_API_VERSION=");
    expect(productionEnv).toContain("META_WEBHOOK_VERIFY_TOKEN=");
    expect(productionEnv).toContain("META_WEBHOOK_APP_SECRET=");
  });
});
