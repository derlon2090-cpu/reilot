import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync("src/app/app.js", "utf8");
const css = readFileSync("src/styles/globals.css", "utf8");
const listRoute = readFileSync("app/api/whatsapp/templates/route.js", "utf8");
const itemRoute = readFileSync("app/api/whatsapp/templates/[id]/route.js", "utf8");
const syncRoute = readFileSync("app/api/whatsapp/templates/sync/route.js", "utf8");

describe("approved Meta templates center", () => {
  it("is a dedicated page in the messages and orders navigation group", () => {
    expect(app).toContain('["/dashboard/approved-templates", "القوالب المعتمدة", "template"]');
    expect(app).toContain('paths: ["/dashboard/order-links", "/dashboard/templates", "/dashboard/approved-templates"');
    expect(app).toContain('"/dashboard/approved-templates": approvedTemplatesPage');
    expect(app).toContain('["/dashboard/templates", "/dashboard/approved-templates"].includes(state.route)');
  });

  it("derives filters, counts and the approval badge from real Meta records", () => {
    expect(app).toContain("function approvedTemplatesPage()");
    expect(app).toContain("const allItems = Array.isArray(payload?.items) ? payload.items : []");
    expect(app).toContain('item.status === "approved" && item.metaStatus === "APPROVED"');
    expect(app).toContain('data-action="meta-template-status-filter"');
    expect(app).toContain('data-action="meta-template-integration-filter"');
    expect(app).toContain('data-action="meta-template-preview"');
    expect(app).toContain('data-action="meta-template-use"');
    expect(app).toContain('state.route !== "/dashboard/approved-templates"');
    expect(app).toContain("60_000");
  });

  it("supports the responsive list, grid, statistics and Meta preview UI", () => {
    for (const selector of [
      ".approved-template-toolbar",
      ".approved-template-stats",
      ".approved-template-table",
      ".approved-template-grid",
      ".approved-template-insights",
      ".approved-template-preview-drawer"
    ]) expect(css).toContain(selector);
    expect(css).toContain("@media(max-width:820px)");
    expect(css).toContain("@media(max-width:520px)");
  });

  it("enforces mutation permissions on the server as well as the interface", () => {
    expect(listRoute).toContain('canCreate: can(role, "create:any")');
    expect(listRoute).toContain('canSubmit: can(role, "update:any")');
    expect(listRoute).toContain('canSync: can(role, "update:any")');
    expect(itemRoute).toContain('can(String(auth.session.role || "").toLowerCase(), "delete:any")');
    expect(syncRoute).toContain('can(String(auth.session.role || "").toLowerCase(), "update:any")');
  });

  it("configures a protected periodic reconciliation in addition to webhook and manual sync", () => {
    const service = readFileSync("src/server/meta-template-service.js", "utf8");
    const cron = readFileSync("app/api/cron/meta-template-reconciliation/route.js", "utf8");
    const vercel = readFileSync("vercel.json", "utf8");
    expect(service).toContain("export async function reconcileAllMetaTemplates()");
    expect(cron).toContain("validateCronRequest(request)");
    expect(cron).toContain("reconcileAllMetaTemplates()");
    expect(vercel).toContain('"path": "/api/cron/meta-template-reconciliation"');
    expect(vercel).toContain('"schedule": "17 */6 * * *"');
  });
});
