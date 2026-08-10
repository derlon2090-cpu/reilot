import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../../src/app/app.js", import.meta.url), "utf8");
const styleSource = readFileSync(new URL("../../src/styles/globals.css", import.meta.url), "utf8");
const listRoute = readFileSync(new URL("../../app/api/contacts/route.js", import.meta.url), "utf8");
const itemRoute = readFileSync(new URL("../../app/api/contacts/[contactId]/route.js", import.meta.url), "utf8");

describe("contacts workspace", () => {
  it("keeps every row clean and moves the six actions into the overflow menu", () => {
    expect(appSource).toContain('data-menu="contact:${escapeHtml(item.id)}"');
    expect(appSource).toContain('["عرض التفاصيل", "contact-details", "eye"]');
    expect(appSource).toContain('["تعديل جهة الاتصال", "contact-edit", "settings"]');
    expect(appSource).toContain('["عرض النشاط", "contact-activity", "reports"]');
    expect(appSource).toContain('["إدارة قنوات التواصل", "contact-channels", "orderLink"]');
    expect(appSource).toContain('"contact-exclude-toggle"');
    expect(appSource).toContain('["حذف جهة الاتصال", "contact-delete", "delete", true');
    expect(appSource).not.toContain('data-action="contact-archive"');
  });

  it("uses drawers and modals backed by real contact and activity endpoints", () => {
    expect(appSource).toContain('openDrawer("تفاصيل جهة الاتصال"');
    expect(appSource).toContain('openDrawer("نشاط جهة الاتصال"');
    expect(appSource).toContain('data-submit="contact-edit"');
    expect(appSource).toContain('data-submit="contact-channels"');
    expect(itemRoute).toContain("FROM campaign_recipients cr");
    expect(itemRoute).toContain("metadata->>'contactId'=$2");
    expect(itemRoute).toContain('normalizeContactEmail');
    expect(itemRoute).toContain('normalizeContactPhone');
  });

  it("enforces campaign exclusion, channel eligibility, and delete permission on the server", () => {
    expect(itemRoute).toContain('z.enum(["active", "archived", "blocked", "merge_review"])');
    expect(itemRoute).toContain('status=$3');
    expect(itemRoute).toContain('if (!canDelete(auth.session.role))');
    expect(itemRoute).toContain('DELETE FROM contacts WHERE tenant_id=$1 AND id=$2');
    expect(listRoute).toContain('permissions: { canEdit: role !== "viewer", canDelete: ["owner", "admin"].includes(role) }');
  });

  it("includes dedicated RTL responsive contact styling", () => {
    expect(styleSource).toContain("/* Contacts workspace */");
    expect(styleSource).toContain(".contacts-primary-actions");
    expect(styleSource).toContain(".contacts-channel-tabs");
    expect(styleSource).toContain(".contact-timeline");
    expect(styleSource).toContain(".contact-channel-controls");
  });
});
