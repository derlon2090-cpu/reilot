import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("system template separation", () => {
  const migration = readFileSync("drizzle/0025_order_portal_links_and_live_time.sql", "utf8");
  const renewalRoute = readFileSync("app/api/templates/renewal/route.js", "utf8");
  const orderRoute = readFileSync("app/api/order-link/templates/route.js", "utf8");
  const defaults = readFileSync("src/server/default-templates.js", "utf8");

  it("defines exactly the three required immutable template keys", () => {
    expect(defaults).toContain('RENEWAL_WHATSAPP: "renewal_whatsapp"');
    expect(defaults).toContain('RENEWAL_EMAIL: "renewal_email"');
    expect(defaults).toContain('ORDER_INFORMATION_SALLA: "order_information_salla"');
  });

  it("scopes the general templates endpoint to renewal templates", () => {
    expect(renewalRoute).toContain("template_group = 'renewal'");
    expect(renewalRoute).toContain("template_key IN ('renewal_whatsapp','renewal_email')");
    expect(renewalRoute).not.toContain("order_information_salla");
  });

  it("scopes order information to its one Salla template", () => {
    expect(orderRoute).toContain("t.template_key='order_information_salla'");
    expect(orderRoute).toContain("ON CONFLICT (tenant_id) DO UPDATE");
  });

  it("cleans duplicates before enforcing tenant template uniqueness", () => {
    expect(migration.indexOf("renewal_template_singletons")).toBeLessThan(migration.indexOf("notification_templates_tenant_key_unique"));
    expect(migration).toContain("order_info_templates_tenant_singleton");
  });

  it("does not create templates while creating an order portal link", () => {
    const service = readFileSync("src/server/order-links.js", "utf8");
    const createStart = service.indexOf("export async function createOrderInfoLink");
    const createBody = service.slice(createStart, service.indexOf("export function hashOrderLinkIp"));
    expect(createBody).not.toContain("INSERT INTO order_info_templates");
    expect(createBody).not.toContain("INSERT INTO notification_templates");
    expect(createBody).toContain("getOrCreateOrderPortalLink");
  });
});
