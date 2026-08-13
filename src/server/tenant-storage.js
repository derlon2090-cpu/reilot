import { query } from "./db.js";

const TABLE_GROUPS = {
  customers: "العملاء والاشتراكات",
  subscriptions: "العملاء والاشتراكات",
  newsletter_profiles: "العملاء والاشتراكات",
  newsletter_subscribers: "العملاء والاشتراكات",
  order_info_links: "روابط وقوالب الطلبات",
  order_info_templates: "روابط وقوالب الطلبات",
  order_link_profiles: "روابط وقوالب الطلبات",
  order_link_events: "روابط وقوالب الطلبات",
  order_template_links: "روابط وقوالب الطلبات",
  notification_logs: "الرسائل والسجلات",
  email_logs: "الرسائل والسجلات",
  message_queue: "الرسائل والسجلات",
  activity_logs: "الرسائل والسجلات",
  ai_conversations: "محادثات ذكاء Renvix",
  ai_messages: "محادثات ذكاء Renvix",
  ai_tool_executions: "محادثات ذكاء Renvix",
  ai_usage_daily: "محادثات ذكاء Renvix",
  ai_user_preferences: "محادثات ذكاء Renvix",
  whatsapp_channels: "الأجهزة",
  commerce_integrations: "التكاملات",
  commerce_order_mappings: "التكاملات",
  app_connections: "التكاملات",
  salla_connection_settings: "التكاملات",
  app_sync_logs: "التكاملات",
  external_orders: "التكاملات",
  oauth_states: "بيانات النظام"
};

function safeTableName(value) {
  return /^[a-z_][a-z0-9_]*$/.test(value) ? value : null;
}

const STORAGE_EXEMPT_PATHS = [
  /^\/api\/auth(?:\/|$)/,
  /^\/api\/billing(?:\/|$)/,
  /^\/api\/settings(?:\/|$)/,
  /^\/api\/support(?:\/|$)/,
  /^\/api\/notifications(?:\/|$)/,
  /^\/api\/unsubscribes(?:\/|$)/,
  /^\/api\/order-link\/profile$/
];

const STORAGE_REQUIRED_PATHS = [
  /^\/api\/settings\/profile\/avatar$/,
  /^\/api\/support\/tickets\/[^/]+\/attachments$/,
  /^\/api\/order-link\/profile\/logo$/
];

const STORAGE_RELEASE_ACTIONS = /\/(?:archive|cancel|disable|disconnect|dismiss|pause|revoke|read|seen|mark-read|mark-all-read)(?:\/|$)/;

function planStorageSql() {
  return `COALESCE(
    (SELECT pp.storage_limit_mb
       FROM platform_subscriptions ps
       JOIN platform_plans pp ON pp.id = ps.plan_id
      WHERE ps.tenant_id = $1
        AND ps.status IN ('active','trial','past_due')
        AND ps.current_period_end > now()
      ORDER BY CASE ps.status WHEN 'active' THEN 0 WHEN 'trial' THEN 1 ELSE 2 END,
               ps.created_at DESC LIMIT 1),
    (SELECT storage_limit_mb FROM platform_plans WHERE slug = 'free' AND is_active = true LIMIT 1),
    1
  )`;
}

function storageResult(usedBytesValue, limitMbValue) {
  const usedBytes = Math.max(0, Number(usedBytesValue || 0));
  const configuredLimitMb = Number(limitMbValue ?? 1);
  const isUnlimited = Number.isFinite(configuredLimitMb) && configuredLimitMb < 0;
  const limitMb = isUnlimited ? -1 : Math.max(1, Number(configuredLimitMb || 1));
  const limitBytes = isUnlimited ? -1 : limitMb * 1024 * 1024;
  const percent = isUnlimited ? 0 : Math.round((usedBytes / limitBytes) * 1000) / 10;
  return {
    usedBytes,
    usedMb: Math.round((usedBytes / 1024 / 1024) * 100) / 100,
    limitBytes,
    limitMb,
    remainingBytes: isUnlimited ? -1 : Math.max(0, limitBytes - usedBytes),
    percent,
    progressPercent: Math.min(100, percent),
    isUnlimited,
    isLimitReached: !isUnlimited && usedBytes >= limitBytes,
    isOverLimit: !isUnlimited && usedBytes > limitBytes
  };
}

export function requestNeedsStorageCapacity(request) {
  const method = String(request?.method || "GET").toUpperCase();
  if (!new Set(["POST", "PUT", "PATCH"]).has(method)) return false;
  let pathname = "";
  try { pathname = new URL(request.url).pathname; } catch { return false; }
  if (STORAGE_REQUIRED_PATHS.some((pattern) => pattern.test(pathname))) return true;
  if (STORAGE_EXEMPT_PATHS.some((pattern) => pattern.test(pathname))) return false;
  return !STORAGE_RELEASE_ACTIONS.test(pathname);
}

export async function getTenantStorageLimitState(tenantId, runner = { query }) {
  const result = await runner.query(
    `SELECT COALESCE(u.used_bytes, 0)::bigint AS "usedBytes",
            (${planStorageSql()})::int AS "limitMb"
       FROM (SELECT $1::uuid AS tenant_id) input
       LEFT JOIN tenant_storage_usage u ON u.tenant_id = input.tenant_id`,
    [tenantId]
  );
  return storageResult(result.rows[0]?.usedBytes, result.rows[0]?.limitMb);
}

export function storageLimitResponse(storage) {
  return Response.json({
    ok: false,
    reason: "storage_limit_reached",
    message: "مساحة باقتك ممتلئة. طوّر الباقة للمتابعة أو احذف بيانات لم تعد تحتاجها ثم أعد المحاولة.",
    upgrade_required: true,
    deletion_allowed: true,
    storage
  }, { status: 403 });
}

export async function getTenantStorage(tenantId, runner = { query }) {
  const [tables, plan] = await Promise.all([
    runner.query(
      `SELECT DISTINCT table_name AS "tableName"
         FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'tenant_id'
          AND table_name <> 'tenant_storage_usage'`
    ),
    runner.query(
      `SELECT (${planStorageSql()})::int AS "limitMb"`,
      [tenantId]
    )
  ]);

  const breakdownMap = new Map();
  let usedBytes = 0;
  for (const row of tables.rows) {
    const table = safeTableName(row.tableName);
    if (!table) continue;
    const recordSize = table === "ai_messages"
      ? `pg_column_size(record) + COALESCE((SELECT sum(CASE WHEN (attachment->>'size') ~ '^[0-9]+$' THEN (attachment->>'size')::bigint ELSE 0 END) FROM jsonb_array_elements(COALESCE(record.attachments,'[]'::jsonb)) attachment),0)`
      : "pg_column_size(record)";
    const result = await runner.query(
      `SELECT COALESCE(sum(${recordSize}), 0)::bigint AS bytes
         FROM ${table} AS record WHERE tenant_id = $1`,
      [tenantId]
    );
    const bytes = Number(result.rows[0]?.bytes || 0);
    usedBytes += bytes;
    const group = TABLE_GROUPS[table] || "بيانات النظام";
    breakdownMap.set(group, (breakdownMap.get(group) || 0) + bytes);
  }

  const summary = storageResult(usedBytes, plan.rows[0]?.limitMb);
  return {
    ...summary,
    breakdown: [...breakdownMap.entries()]
      .map(([label, bytes]) => ({ label, bytes, mb: Math.round((bytes / 1024 / 1024) * 100) / 100 }))
      .filter((item) => item.bytes > 0)
      .sort((a, b) => b.bytes - a.bytes)
  };
}
