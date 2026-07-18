import { query } from "./db.js";

const TABLE_GROUPS = {
  customers: "العملاء والاشتراكات",
  subscriptions: "العملاء والاشتراكات",
  order_info_links: "روابط وقوالب الطلبات",
  order_info_templates: "روابط وقوالب الطلبات",
  order_link_profiles: "روابط وقوالب الطلبات",
  order_link_events: "روابط وقوالب الطلبات",
  order_template_links: "روابط وقوالب الطلبات",
  notification_logs: "الرسائل والسجلات",
  email_logs: "الرسائل والسجلات",
  message_queue: "الرسائل والسجلات",
  activity_logs: "الرسائل والسجلات",
  whatsapp_channels: "الأجهزة",
  commerce_integrations: "التكاملات",
  commerce_order_mappings: "التكاملات"
};

function safeTableName(value) {
  return /^[a-z_][a-z0-9_]*$/.test(value) ? value : null;
}

export async function getTenantStorage(tenantId) {
  const [tables, plan] = await Promise.all([
    query(
      `SELECT DISTINCT table_name AS "tableName"
         FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'tenant_id'`
    ),
    query(
      `SELECT COALESCE(pp.storage_limit_mb, 100)::int AS "limitMb"
         FROM platform_subscriptions ps
         JOIN platform_plans pp ON pp.id = ps.plan_id
        WHERE ps.tenant_id = $1 ORDER BY ps.created_at DESC LIMIT 1`,
      [tenantId]
    )
  ]);

  const breakdownMap = new Map();
  let usedBytes = 0;
  for (const row of tables.rows) {
    const table = safeTableName(row.tableName);
    if (!table) continue;
    const result = await query(
      `SELECT COALESCE(sum(pg_column_size(record)), 0)::bigint AS bytes
         FROM ${table} AS record WHERE tenant_id = $1`,
      [tenantId]
    );
    const bytes = Number(result.rows[0]?.bytes || 0);
    usedBytes += bytes;
    const group = TABLE_GROUPS[table] || "بيانات النظام";
    breakdownMap.set(group, (breakdownMap.get(group) || 0) + bytes);
  }

  const limitMb = Math.max(100, Number(plan.rows[0]?.limitMb || 100));
  const limitBytes = limitMb * 1024 * 1024;
  return {
    usedBytes,
    usedMb: Math.round((usedBytes / 1024 / 1024) * 100) / 100,
    limitMb,
    percent: limitBytes > 0 ? Math.min(100, Math.round((usedBytes / limitBytes) * 1000) / 10) : 0,
    breakdown: [...breakdownMap.entries()]
      .map(([label, bytes]) => ({ label, bytes, mb: Math.round((bytes / 1024 / 1024) * 100) / 100 }))
      .filter((item) => item.bytes > 0)
      .sort((a, b) => b.bytes - a.bytes)
  };
}

