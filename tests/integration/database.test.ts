import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("database integration contract", () => {
  it("keeps required multi-tenant and performance indexes in migrations", () => {
    const schema = ["0001_initial_schema.sql", "0003_cron_auth_safety.sql", "0008_whatsapp_unique_instances.sql"]
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
      "idx_message_usage_month_year"
    ]) {
      expect(schema).toContain(indexName);
    }
    expect(schema).toContain("whatsapp_channels_instance_name_unique");
    expect(schema).toContain("whatsapp_channels_tenant_status_idx");
  });
});
