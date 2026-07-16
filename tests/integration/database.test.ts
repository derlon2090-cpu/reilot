import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("database integration contract", () => {
  it("keeps required multi-tenant and performance indexes in migrations", () => {
    const schema = ["0001_initial_schema.sql", "0003_cron_auth_safety.sql", "0008_whatsapp_unique_instances.sql", "0009_order_information_links.sql"]
      .map((file) => readFileSync(`drizzle/${file}`, "utf8"))
      .join("\n");

    for (const indexName of [
      "idx_subscriptions_tenant_id",
      "idx_subscriptions_end_date",
      "idx_subscriptions_status",
      "idx_customers_tenant_id",
      "idx_whatsapp_channels_tenant_id",
      "idx_notification_logs_tenant_id",
      "idx_notification_logs_status",
      "idx_message_queue_scheduled_for",
      "idx_message_usage_month_year",
      "idx_order_link_profiles_slug_lower",
      "idx_order_info_templates_tenant_active",
      "idx_order_info_links_public_lookup",
      "idx_order_link_events_tenant_type"
    ]) {
      expect(schema).toContain(indexName);
    }
    expect(schema).toContain("whatsapp_channels_instance_name_unique");
    expect(schema).toContain("whatsapp_channels_tenant_status_idx");
    for (const table of ["order_link_profiles", "order_info_templates", "order_info_links", "order_link_events"]) {
      expect(schema).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });
});
