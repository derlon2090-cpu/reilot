import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("database integration contract", () => {
  it("keeps required multi-tenant and performance indexes in migrations", () => {
    const schema = ["0001_initial_schema.sql", "0003_cron_auth_safety.sql", "0008_whatsapp_unique_instances.sql", "0009_order_information_links.sql", "0010_stable_template_order_links.sql"]
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
      "idx_order_link_events_tenant_type",
      "idx_order_template_links_tenant_status",
      "idx_order_template_links_public_lookup",
      "idx_order_info_links_template_subscription",
      "idx_order_info_links_template_order"
    ]) {
      expect(schema).toContain(indexName);
    }
    expect(schema).toContain("whatsapp_channels_instance_name_unique");
    expect(schema).toContain("whatsapp_channels_tenant_status_idx");
    for (const table of ["order_link_profiles", "order_info_templates", "order_template_links", "order_info_links", "order_link_events"]) {
      expect(schema).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
    expect(schema).toContain("template_id uuid NOT NULL REFERENCES order_info_templates(id) ON DELETE CASCADE UNIQUE");
    expect(schema).toContain("template_link_id uuid REFERENCES order_template_links(id) ON DELETE CASCADE");
    expect(schema).toContain("order_info_link_dedup");
    expect(schema).toContain("SET order_info_link_id = dedup.keeper_id");
  });
});
