import { query, transaction } from "./db.js";
import { getTenantStorage } from "./tenant-storage.js";

const MAX_CLEANUP_BYTES = 1024 * 1024 * 1024;

export const STORAGE_CLEANUP_CATEGORIES = [
  {
    key: "delivery_history",
    label: "سجلات الإرسال المكتملة",
    description: "رسائل مكتملة أو فاشلة أقدم من 30 يومًا.",
    sources: [
      { table: "message_queue", dateColumn: "updated_at", where: "status IN ('sent','failed','cancelled','skipped') AND updated_at < now() - interval '30 days'" },
      { table: "notification_logs", dateColumn: "created_at", where: "status IN ('sent','delivered','read','failed','cancelled') AND created_at < now() - interval '30 days'" },
      { table: "email_logs", dateColumn: "created_at", where: "lower(status) IN ('sent','delivered','read','failed','cancelled','bounced') AND created_at < now() - interval '30 days'" }
    ]
  },
  {
    key: "activity_history",
    label: "سجل النشاط القديم",
    description: "أحداث تشغيلية أقدم من 90 يومًا.",
    sources: [
      { table: "activity_logs", dateColumn: "created_at", where: "created_at < now() - interval '90 days'" }
    ]
  },
  {
    key: "link_history",
    label: "سجل استخدام الروابط",
    description: "زيارات وأحداث روابط الطلبات الأقدم من 90 يومًا.",
    sources: [
      { table: "order_link_events", dateColumn: "created_at", where: "created_at < now() - interval '90 days'" }
    ]
  },
  {
    key: "archived_ai_chats",
    label: "محادثات الذكاء المؤرشفة",
    description: "المحادثات المحذوفة أو المؤرشفة القديمة وغير المثبتة.",
    sources: [
      {
        table: "ai_conversations",
        dateColumn: "last_message_at",
        where: "is_pinned = false AND (status = 'deleted' OR (status = 'archived' AND last_message_at < now() - interval '30 days'))",
        sizeExpression: `(pg_column_size(row_value)
          + COALESCE((SELECT sum(pg_column_size(message_row)) FROM ai_messages message_row WHERE message_row.conversation_id=row_value.id),0)
          + COALESCE((SELECT sum(pg_column_size(tool_row)) FROM ai_tool_executions tool_row WHERE tool_row.conversation_id=row_value.id),0))`
      }
    ]
  }
];

const CATEGORY_MAP = new Map(STORAGE_CLEANUP_CATEGORIES.map((item) => [item.key, item]));

function sourceSize(source) {
  return source.sizeExpression || "pg_column_size(row_value)";
}

async function sourceSummary(tenantId, source, runner) {
  const result = await runner.query(
    `SELECT count(*)::int AS count, COALESCE(sum(${sourceSize(source)}),0)::bigint AS bytes
       FROM ${source.table} row_value
      WHERE tenant_id=$1 AND ${source.where}`,
    [tenantId]
  );
  return {
    count: Math.max(0, Number(result.rows[0]?.count || 0)),
    bytes: Math.max(0, Number(result.rows[0]?.bytes || 0))
  };
}

export async function getStorageCleanupPreview(tenantId, runner = { query }) {
  const categories = await Promise.all(STORAGE_CLEANUP_CATEGORIES.map(async (category) => {
    const summaries = await Promise.all(category.sources.map((source) => sourceSummary(tenantId, source, runner)));
    return {
      key: category.key,
      label: category.label,
      description: category.description,
      count: summaries.reduce((sum, item) => sum + item.count, 0),
      bytes: summaries.reduce((sum, item) => sum + item.bytes, 0)
    };
  }));
  const cleanableBytes = categories.reduce((sum, item) => sum + item.bytes, 0);
  return {
    cleanableBytes,
    cleanableRows: categories.reduce((sum, item) => sum + item.count, 0),
    categories
  };
}

export function selectStorageCleanupRows(rows = [], targetBytes = 0) {
  const requestedBytes = Math.min(MAX_CLEANUP_BYTES, Math.max(1, Number(targetBytes || 0)));
  const selected = [];
  let estimatedBytes = 0;
  for (const row of [...rows].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))) {
    if (estimatedBytes >= requestedBytes) break;
    const bytes = Math.max(0, Number(row.storageBytes || 0));
    if (!bytes) continue;
    selected.push(row);
    estimatedBytes += bytes;
  }
  return { selected, estimatedBytes, requestedBytes };
}

async function cleanupCandidates(tenantId, category, runner) {
  const groups = await Promise.all(category.sources.map(async (source) => {
    const result = await runner.query(
      `SELECT id, ${sourceSize(source)}::bigint AS "storageBytes", ${source.dateColumn} AS "createdAt"
         FROM ${source.table} row_value
        WHERE tenant_id=$1 AND ${source.where}
        ORDER BY ${source.dateColumn} ASC, id ASC
        LIMIT 10000`,
      [tenantId]
    );
    return result.rows.map((row) => ({ ...row, table: source.table }));
  }));
  return groups.flat();
}

export async function cleanupTenantStorage(session, input = {}) {
  const targetBytes = Number(input.targetBytes || 0);
  if (!Number.isFinite(targetBytes) || targetBytes < 1 || targetBytes > MAX_CLEANUP_BYTES) {
    throw Object.assign(new Error("حدد مساحة صالحة تريد إخلاءها."), { status: 400 });
  }
  const requestedCategories = [...new Set(Array.isArray(input.categories) ? input.categories.map(String) : [])];
  const categories = requestedCategories.map((key) => CATEGORY_MAP.get(key)).filter(Boolean);
  if (!categories.length) throw Object.assign(new Error("اختر نوعًا واحدًا على الأقل من البيانات القديمة."), { status: 400 });

  return transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`storage-cleanup:${session.tenantId}`]);
    const before = await getTenantStorage(session.tenantId, client);
    const candidates = (await Promise.all(categories.map((category) => cleanupCandidates(session.tenantId, category, client)))).flat();
    const selection = selectStorageCleanupRows(candidates, targetBytes);
    const byTable = new Map();
    for (const row of selection.selected) {
      if (!byTable.has(row.table)) byTable.set(row.table, []);
      byTable.get(row.table).push(row.id);
    }
    for (const [table, ids] of byTable) {
      await client.query(`DELETE FROM ${table} WHERE tenant_id=$1 AND id=ANY($2::uuid[])`, [session.tenantId, ids]);
    }
    if (selection.selected.length) {
      await client.query(
        `INSERT INTO activity_logs (tenant_id,user_id,type,title,metadata)
         VALUES ($1,$2,'storage.cleanup','Account storage cleanup',$3::jsonb)`,
        [session.tenantId, session.userId, JSON.stringify({
          categories: requestedCategories,
          targetBytes: selection.requestedBytes,
          deletedRows: selection.selected.length
        })]
      );
    }
    const storage = await getTenantStorage(session.tenantId, client);
    const preview = await getStorageCleanupPreview(session.tenantId, client);
    return {
      storage,
      preview,
      freedBytes: Math.max(0, Number(before.usedBytes || 0) - Number(storage.usedBytes || 0)),
      deletedRows: selection.selected.length
    };
  });
}
