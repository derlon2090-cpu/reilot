import { query, transaction } from "../db.js";
import { deleteAttachment } from "./service.js";
import { reconcileTenantStorageUsage } from "../tenant-storage.js";

export const ATTACHMENT_CLEANUP_CATEGORIES = Object.freeze([
  { key: "images", label: "الصور", purpose: "image", protected: false },
  { key: "audio", label: "التسجيلات الصوتية", purpose: "audio", protected: false },
  { key: "chat_files", label: "ملفات المحادثات", purpose: "document", protected: false },
  { key: "ticket_attachments", label: "مرفقات تذاكر الدعم", purpose: null, protected: true },
  { key: "exports", label: "ملفات التصدير", purpose: null, protected: true },
  { key: "all", label: "كل مرفقات المحادثات القابلة للحذف", purpose: "*", protected: false }
]);

const CATEGORY_MAP = new Map(ATTACHMENT_CLEANUP_CATEGORIES.map((item) => [item.key, item]));

function selectedPurposes(categories) {
  const selected = [...new Set(categories.map(String))].map((key) => CATEGORY_MAP.get(key)).filter(Boolean);
  if (!selected.length) throw Object.assign(new Error("اختر فئة واحدة على الأقل."), { code: "CLEANUP_CATEGORY_REQUIRED", status: 400 });
  // Tickets and exports are operational/business records in this repository.
  // They are displayed as protected and are never inferred into a destructive job.
  const deletable = selected.filter((item) => !item.protected);
  if (!deletable.length) {
    throw Object.assign(new Error("الفئات المختارة بيانات أعمال محمية ولا تُحذف ضمن تنظيف مرفقات المحادثات."), {
      code: "CLEANUP_CATEGORY_PROTECTED", status: 409
    });
  }
  return deletable.some((item) => item.purpose === "*")
    ? ["image", "audio", "document"]
    : [...new Set(deletable.map((item) => item.purpose))];
}

export async function attachmentCleanupPreview(session) {
  const result = await query(
    `SELECT purpose,count(*)::int AS count,COALESCE(sum(size_bytes),0)::bigint AS bytes
       FROM ai_attachments
      WHERE tenant_id=$1 AND user_id=$2 AND status NOT IN ('deleting','deleted')
      GROUP BY purpose`,
    [session.tenantId, session.userId]
  );
  const byPurpose = new Map(result.rows.map((row) => [row.purpose, { count: Number(row.count), bytes: Number(row.bytes) }]));
  return ATTACHMENT_CLEANUP_CATEGORIES.map((category) => {
    const summary = category.purpose === "*"
      ? [...byPurpose.values()].reduce((total, item) => ({ count: total.count + item.count, bytes: total.bytes + item.bytes }), { count: 0, bytes: 0 })
      : byPurpose.get(category.purpose) || { count: 0, bytes: 0 };
    return { key: category.key, label: category.label, ...summary, protected: category.protected };
  });
}

export async function createAttachmentCleanupJob(session, input = {}) {
  const categories = [...new Set((Array.isArray(input.categories) ? input.categories : []).map(String))];
  const purposes = selectedPurposes(categories);
  const limit = Math.max(1, Math.min(10_000, Number(input.limit || 10_000)));
  return transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`attachment-cleanup:${session.tenantId}:${session.userId}`]);
    const existing = await client.query(
      `SELECT id FROM storage_cleanup_jobs
        WHERE tenant_id=$1 AND user_id=$2 AND status IN ('queued','processing') LIMIT 1`,
      [session.tenantId, session.userId]
    );
    if (existing.rows[0]) return { id: existing.rows[0].id, status: "queued", idempotent: true };
    const candidates = await client.query(
      `SELECT id,size_bytes AS "sizeBytes" FROM ai_attachments
        WHERE tenant_id=$1 AND user_id=$2 AND purpose=ANY($3::text[])
          AND status NOT IN ('deleting','deleted')
        ORDER BY created_at,id LIMIT $4`,
      [session.tenantId, session.userId, purposes, limit]
    );
    const estimatedBytes = candidates.rows.reduce((sum, row) => sum + Number(row.sizeBytes || 0), 0);
    const inserted = await client.query(
      `INSERT INTO storage_cleanup_jobs
        (tenant_id,user_id,categories,total_items,estimated_bytes,status)
       VALUES($1,$2,$3,$4,$5,'queued') RETURNING id,status,total_items AS "totalItems",estimated_bytes AS "estimatedBytes"`,
      [session.tenantId, session.userId, categories, candidates.rows.length, estimatedBytes]
    );
    if (candidates.rows.length) {
      await client.query(
        `INSERT INTO storage_cleanup_job_items(job_id,attachment_id)
         SELECT $1,unnest($2::uuid[])`,
        [inserted.rows[0].id, candidates.rows.map((row) => row.id)]
      );
    } else {
      await client.query(`UPDATE storage_cleanup_jobs SET status='completed',completed_at=now() WHERE id=$1`, [inserted.rows[0].id]);
      inserted.rows[0].status = "completed";
    }
    return { ...inserted.rows[0], idempotent: false };
  });
}

export async function getAttachmentCleanupJob(session, jobId) {
  const result = await query(
    `SELECT id,categories,status,total_items AS "totalItems",processed_items AS "processedItems",
            failed_items AS "failedItems",estimated_bytes AS "estimatedBytes",freed_bytes AS "freedBytes",
            failure_code AS "failureCode",created_at AS "createdAt",started_at AS "startedAt",completed_at AS "completedAt"
       FROM storage_cleanup_jobs WHERE id=$1 AND tenant_id=$2 AND user_id=$3 LIMIT 1`,
    [jobId, session.tenantId, session.userId]
  );
  if (!result.rows[0]) throw Object.assign(new Error("مهمة التنظيف غير موجودة."), { code: "CLEANUP_JOB_NOT_FOUND", status: 404 });
  return result.rows[0];
}

export async function processAttachmentCleanupJob(jobId, { batchSize = 25 } = {}) {
  const jobResult = await query(
    `UPDATE storage_cleanup_jobs SET status='processing',started_at=COALESCE(started_at,now())
      WHERE id=$1 AND status IN ('queued','processing','failed')
      RETURNING id,tenant_id AS "tenantId",user_id AS "userId"`,
    [jobId]
  );
  const job = jobResult.rows[0];
  if (!job) return { processed: 0, done: true };
  const items = await query(
    `UPDATE storage_cleanup_job_items item SET status='processing',attempts=attempts+1,updated_at=now()
      WHERE (job_id,attachment_id) IN (
        SELECT job_id,attachment_id FROM storage_cleanup_job_items
         WHERE job_id=$1 AND status IN ('queued','failed') AND attempts<3
         ORDER BY updated_at,attachment_id FOR UPDATE SKIP LOCKED LIMIT $2
      ) RETURNING attachment_id AS "attachmentId"`,
    [jobId, Math.max(1, Math.min(100, Number(batchSize || 25)))]
  );
  let completed = 0;
  let failed = 0;
  let freedBytes = 0;
  for (const item of items.rows) {
    const before = await query(
      `SELECT size_bytes AS "sizeBytes" FROM ai_attachments WHERE id=$1 AND tenant_id=$2 AND user_id=$3`,
      [item.attachmentId, job.tenantId, job.userId]
    );
    try {
      await deleteAttachment({ tenantId: job.tenantId, userId: job.userId }, item.attachmentId, { reconcileStorage: false });
      freedBytes += Number(before.rows[0]?.sizeBytes || 0);
      completed += 1;
      await query(
        `UPDATE storage_cleanup_job_items SET status='completed',failure_code=NULL,updated_at=now()
          WHERE job_id=$1 AND attachment_id=$2`, [jobId, item.attachmentId]
      );
    } catch (error) {
      failed += 1;
      await query(
        `UPDATE storage_cleanup_job_items SET status='failed',failure_code=$3,updated_at=now()
          WHERE job_id=$1 AND attachment_id=$2`,
        [jobId, item.attachmentId, String(error?.code || "HARD_DELETE_FAILED").slice(0, 80)]
      );
    }
  }
  const status = await query(
    `WITH counts AS (
       SELECT count(*) FILTER (WHERE status='completed')::int AS completed,
              count(*) FILTER (WHERE status='failed' AND attempts>=3)::int AS terminal_failed,
              count(*) FILTER (WHERE status IN ('queued','processing') OR (status='failed' AND attempts<3))::int AS remaining
         FROM storage_cleanup_job_items WHERE job_id=$1
     ) UPDATE storage_cleanup_jobs job SET
       processed_items=counts.completed,failed_items=counts.terminal_failed,
       freed_bytes=job.freed_bytes+$2,
       status=CASE WHEN counts.remaining=0 AND counts.terminal_failed=0 THEN 'completed'
                   WHEN counts.remaining=0 THEN 'failed' ELSE 'processing' END,
       completed_at=CASE WHEN counts.remaining=0 THEN now() ELSE NULL END,
       failure_code=CASE WHEN counts.terminal_failed>0 THEN 'ITEM_RETRIES_EXHAUSTED' ELSE NULL END
     FROM counts WHERE job.id=$1
     RETURNING job.status,counts.remaining,job.processed_items AS "processedItems",job.failed_items AS "failedItems"`,
    [jobId, freedBytes]
  );
  if (completed > 0) await reconcileTenantStorageUsage(job.tenantId);
  return { processed: completed, failed, ...status.rows[0], done: Number(status.rows[0]?.remaining || 0) === 0 };
}

export async function runAttachmentCleanupWorker() {
  const jobs = await query(
    `SELECT id FROM storage_cleanup_jobs WHERE status IN ('queued','processing') ORDER BY created_at LIMIT 20`
  ).catch((error) => error?.code === "42P01" ? { rows: [] } : Promise.reject(error));
  const results = [];
  for (const job of jobs.rows) results.push(await processAttachmentCleanupJob(job.id));
  return { jobs: jobs.rows.length, results };
}

export async function reconcileDeletingAttachments() {
  const rows = await query(
    `SELECT id,tenant_id AS "tenantId",user_id AS "userId" FROM ai_attachments
      WHERE status='deleting' AND deletion_requested_at<now()-interval '5 minutes'
      ORDER BY deletion_requested_at LIMIT 100`
  ).catch((error) => error?.code === "42703" ? { rows: [] } : Promise.reject(error));
  let recovered = 0;
  let failed = 0;
  for (const row of rows.rows) {
    try {
      await deleteAttachment({ tenantId: row.tenantId, userId: row.userId }, row.id);
      recovered += 1;
    } catch { failed += 1; }
  }
  return { checked: rows.rows.length, recovered, failed };
}
