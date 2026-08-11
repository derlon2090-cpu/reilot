import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeAdminCampaignRecipients } from "../../src/server/admin-campaigns.js";

const read = (path: string) => readFileSync(resolve(path), "utf8");
const ui = read("src/components/admin/AdminSections.jsx");
const portal = read("src/components/admin/AdminPortal.jsx");
const devices = read("src/server/admin-evolution-devices.js");
const campaigns = read("src/server/admin-campaigns.js");
const overview = read("app/api/admin/overview/route.js");
const api = read("app/api/admin/campaigns/route.js");
const migration = read("drizzle/0068_admin_devices_and_campaigns.sql");

describe("admin device and campaign isolation", () => {
  it("keeps the admin device inventory on the platform channel table only", () => {
    expect(devices).toContain("FROM platform_messaging_channels");
    expect(devices).toContain("provider='evolution_admin'");
    expect(devices).toContain("messaging_scope='platform_admin'");
    expect(devices).not.toContain("FROM whatsapp_channels");
    expect(devices).not.toContain("JOIN tenants");
    expect(devices).not.toContain("JOIN stores");
  });

  it("replaces customer campaign monitoring with an admin-only composer", () => {
    expect(ui).toContain("إرسال حملة إدارية");
    expect(ui).toContain("يعرض حملات الأدمن فقط");
    expect(portal).not.toContain("حملات المستخدمين عبر واتساب والبريد");
    expect(overview).not.toContain("FROM campaigns");
    expect(campaigns).toContain("FROM admin_campaigns");
    expect(api).toContain('requireAdminPermission(request, "campaigns", "create")');
  });

  it("normalizes, validates, and deduplicates manual admin recipients", () => {
    expect(normalizeAdminCampaignRecipients("USER@example.com\nuser@example.com\nother@example.com", "email")).toEqual({
      valid: ["user@example.com", "other@example.com"], invalid: []
    });
    expect(normalizeAdminCampaignRecipients("+966 50 000 0000\ninvalid", "evolution_whatsapp")).toEqual({
      valid: ["966500000000"], invalid: ["invalid"]
    });
  });

  it("persists campaigns and encrypted recipients in dedicated admin tables", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS admin_campaigns");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS admin_campaign_recipients");
    expect(migration).toContain("recipient_encrypted text NOT NULL");
    expect(campaigns).toContain("encryptSecret(recipient");
    expect(campaigns).toContain("FOR UPDATE OF r SKIP LOCKED");
  });
});
