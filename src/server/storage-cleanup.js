import { query, transaction } from "./db.js";
import { getTenantStorage } from "./tenant-storage.js";

const MAX_CLEANUP_BYTES = 1024 * 1024 * 1024;

export const STORAGE_CLEANUP_CATEGORIES = [
  {
    key: "order_content",
    label: "روابط وقوالب الطلبات",
    description: "يشمل الشعارات والروابط والقوالب؛ يستهدف الإخلاء الشعار المحفوظ والروابط غير النشطة فقط.",
    sources: [
      {
        table: "order_link_profiles",
        dateColumn: "updated_at",
        where: "logo_data IS NOT NULL OR logo_url IS NOT NULL",
        sizeExpression: "COALESCE(pg_column_size(row_value.logo_data),0) + COALESCE(pg_column_size(row_value.logo_url),0) + COALESCE(pg_column_size(row_value.logo_content_type),0)",
        operation: "clear_order_link_logo"
      },
      { table: "order_info_links", dateColumn: "updated_at", where: "status IN ('expired','disabled','archived')" },
      {
        table: "order_link_events",
        dateColumn: "created_at",
        where: "created_at < now() - interval '30 days' AND EXISTS (SELECT 1 FROM order_info_links link WHERE link.id=row_value.order_info_link_id AND link.status='active')"
      }
    ]
  },
  {
    key: "message_history",
    label: "الرسائل والسجلات",
    description: "الرسائل المكتملة أو المتعثرة والسجلات التشغيلية القديمة، دون المساس بالرسائل قيد الإرسال.",
    sources: [
      { table: "message_queue", dateColumn: "updated_at", where: "status IN ('sent','failed','cancelled','skipped')" },
      { table: "notification_logs", dateColumn: "created_at", where: "status IN ('sent','delivered','read','failed','cancelled')" },
      { table: "email_logs", dateColumn: "created_at", where: "lower(status) IN ('sent','delivered','read','failed','cancelled','bounced')" },
      { table: "activity_logs", dateColumn: "created_at", where: "created_at < now() - interval '30 days'" }
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
      WHERE tenant_id=$1 AND (${source.where})`,
    [tenantId]
  );
  return {
    count: Math.max(0, Number(result.rows[0]?.count || 0)),
    bytes: Math.max(0, Number(result.rows[0]?.bytes || 0))
  };
}

export async function getStorageCleanupPreview(tenantId, runner = { query }) {
  const [cleanupCategories, storage] = await Promise.all([
    Promise.all(STORAGE_CLEANUP_CATEGORIES.map(async (category) => {
      const summaries = await Promise.all(category.sources.map((source) => sourceSummary(tenantId, source, runner)));
      return {
        key: category.key,
        label: category.label,
        description: category.description,
        count: summaries.reduce((sum, item) => sum + item.count, 0),
        bytes: summaries.reduce((sum, item) => sum + item.bytes, 0)
      };
    })),
    getTenantStorage(tenantId, runner)
  ]);
  const cleanupByLabel = new Map(cleanupCategories.map((item) => [item.label, item]));
  const categories = storage.breakdown.map((item, index) => {
    const cleanup = cleanupByLabel.get(item.label);
    const cleanableBytes = Math.min(item.bytes, Math.max(0, Number(cleanup?.bytes || 0)));
    return {
      key: cleanup?.key || `protected:${index}`,
      label: item.label,
      description: cleanup?.description || "بيانات أساسية أو نشطة تحتفظ بها المنصة لتشغيل حسابك بصورة صحيحة.",
      count: Math.max(0, Number(cleanup?.count || 0)),
      bytes: item.bytes,
      cleanableBytes,
      protectedBytes: Math.max(0, item.bytes - cleanableBytes)
    };
  });
  const cleanableBytes = categories.reduce((sum, item) => sum + item.cleanableBytes, 0);
  return {
    totalBytes: storage.usedBytes,
    cleanableBytes,
    cleanableRows: cleanupCategories.reduce((sum, item) => sum + item.count, 0),
    categories,
    storage
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
        WHERE tenant_id=$1 AND (${source.where})
        ORDER BY ${source.dateColumn} ASC, id ASC
        LIMIT 10000`,
      [tenantId]
    );
    return result.rows.map((row) => ({ ...row, table: source.table, operation: source.operation || "delete" }));
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
  if (!categories.length) throw Object.assign(new Error("اختر عنصرًا واحدًا على الأقل من البيانات القابلة للإخلاء."), { status: 400 });

  return transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`storage-cleanup:${session.tenantId}`]);
    const before = await getTenantStorage(session.tenantId, client);
    const candidates = (await Promise.all(categories.map((category) => cleanupCandidates(session.tenantId, category, client)))).flat();
    const selection = selectStorageCleanupRows(candidates, targetBytes);
    const byTable = new Map();
    const logoProfileIds = [];
    for (const row of selection.selected) {
      if (row.operation === "clear_order_link_logo") {
        logoProfileIds.push(row.id);
        continue;
      }
      if (!byTable.has(row.table)) byTable.set(row.table, []);
      byTable.get(row.table).push(row.id);
    }
    if (logoProfileIds.length) {
      await client.query(
        `UPDATE order_link_profiles
            SET logo_url=NULL,logo_data=NULL,logo_content_type=NULL,logo_updated_at=NULL,updated_at=now()
          WHERE tenant_id=$1 AND id=ANY($2::uuid[])`,
        [session.tenantId, logoProfileIds]
      );
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
