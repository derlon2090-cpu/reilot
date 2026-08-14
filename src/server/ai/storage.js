import { query } from "../db.js";
import { deleteObjectsForConversation } from "../attachments/service.js";

const MAX_CLEANUP_BYTES = 1024 * 1024 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeConversationId(value) {
  const id = String(value || "").trim();
  return UUID_PATTERN.test(id) ? id : null;
}

function rowBytes(row) {
  return Math.max(0, Number(row?.storageBytes || 0));
}

function attachmentSchemaUnavailable(error) {
  return ["42P01", "42703"].includes(String(error?.code || error?.cause?.code || ""));
}

async function withLegacyAttachmentFallback(primary, fallback) {
  try {
    return await primary();
  } catch (error) {
    if (!attachmentSchemaUnavailable(error)) throw error;
    return fallback();
  }
}

export function selectAIStorageCleanupCandidates(rows = [], targetBytes = 0, { keepConversationId = null } = {}) {
  const requested = Math.min(MAX_CLEANUP_BYTES, Math.max(1, Number(targetBytes || 0)));
  const keepId = safeConversationId(keepConversationId);
  const eligible = rows.filter((row) => !row.isPinned && row.id !== keepId);
  const newestRetainedId = keepId ? null : [...eligible]
    .filter((row) => row.status !== "deleted")
    .sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0))[0]?.id;
  const candidates = eligible.filter((row) => row.id !== newestRetainedId);
  const selected = [];
  let estimatedFreedBytes = 0;
  for (const row of candidates) {
    if (estimatedFreedBytes >= requested) break;
    selected.push(row);
    estimatedFreedBytes += rowBytes(row);
  }
  return { selected, estimatedFreedBytes, requestedBytes: requested, retainedConversationId: keepId || newestRetainedId || null };
}

async function conversationStorageRows(session, runner, keepConversationId = null) {
  const parameters = [session.tenantId, session.userId, safeConversationId(keepConversationId)];
  const result = await withLegacyAttachmentFallback(() => runner.query(
    `SELECT c.id,c.status,c.is_pinned AS "isPinned",c.last_message_at AS "lastMessageAt",
       (pg_column_size(c)
        + COALESCE((SELECT sum(pg_column_size(m)) FROM ai_messages m WHERE m.conversation_id=c.id),0)
        + COALESCE((SELECT sum(a.size_bytes) FROM ai_attachments a
           WHERE a.conversation_id=c.id AND a.deleted_at IS NULL),0)
        + COALESCE((SELECT sum(pg_column_size(x)) FROM ai_tool_executions x WHERE x.conversation_id=c.id),0))::bigint AS "storageBytes"
       ,ARRAY(SELECT DISTINCT a.object_key FROM ai_attachments a
          WHERE a.conversation_id=c.id AND a.deleted_at IS NULL) AS "attachmentKeys"
       FROM ai_conversations c
      WHERE c.tenant_id=$1 AND c.user_id=$2
        AND ($3::uuid IS NULL OR c.id <> $3::uuid)
      ORDER BY CASE c.status WHEN 'deleted' THEN 0 WHEN 'archived' THEN 1 ELSE 2 END,
               c.last_message_at ASC
      LIMIT 500`,
    parameters
  ), () => runner.query(
    `SELECT c.id,c.status,c.is_pinned AS "isPinned",c.last_message_at AS "lastMessageAt",
       (pg_column_size(c)
        + COALESCE((SELECT sum(pg_column_size(m)) FROM ai_messages m WHERE m.conversation_id=c.id),0)
        + COALESCE((SELECT sum(CASE WHEN attachment->>'size' ~ '^[0-9]+$'
                                      THEN (attachment->>'size')::bigint ELSE 0 END)
            FROM ai_messages m
            CROSS JOIN LATERAL jsonb_array_elements(COALESCE(m.attachments,'[]'::jsonb)) attachment
           WHERE m.conversation_id=c.id),0)
        + COALESCE((SELECT sum(pg_column_size(x)) FROM ai_tool_executions x WHERE x.conversation_id=c.id),0))::bigint AS "storageBytes",
       ARRAY(SELECT DISTINCT COALESCE(attachment->>'objectKey',attachment->>'object_key')
          FROM ai_messages m
          CROSS JOIN LATERAL jsonb_array_elements(COALESCE(m.attachments,'[]'::jsonb)) attachment
         WHERE m.conversation_id=c.id
           AND COALESCE(attachment->>'objectKey',attachment->>'object_key') IS NOT NULL) AS "attachmentKeys"
       FROM ai_conversations c
      WHERE c.tenant_id=$1 AND c.user_id=$2
        AND ($3::uuid IS NULL OR c.id <> $3::uuid)
      ORDER BY CASE c.status WHEN 'deleted' THEN 0 WHEN 'archived' THEN 1 ELSE 2 END,
               c.last_message_at ASC
      LIMIT 500`,
    parameters
  ));
  return result.rows;
}

async function totalAIChatStorage(session, runner) {
  const parameters = [session.tenantId, session.userId];
  const result = await withLegacyAttachmentFallback(() => runner.query(
    `SELECT (
       COALESCE((SELECT sum(pg_column_size(c)) FROM ai_conversations c WHERE c.tenant_id=$1 AND c.user_id=$2),0)
       + COALESCE((SELECT sum(pg_column_size(m)) FROM ai_messages m WHERE m.tenant_id=$1 AND m.user_id=$2),0)
       + COALESCE((SELECT sum(a.size_bytes) FROM ai_attachments a
          WHERE a.tenant_id=$1 AND a.user_id=$2 AND a.deleted_at IS NULL),0)
       + COALESCE((SELECT sum(pg_column_size(x)) FROM ai_tool_executions x WHERE x.tenant_id=$1 AND x.user_id=$2),0)
     )::bigint AS "totalBytes",
     (SELECT count(*)::int FROM ai_conversations c WHERE c.tenant_id=$1 AND c.user_id=$2 AND c.status <> 'deleted') AS "conversationCount"`,
    parameters
  ), () => runner.query(
    `SELECT (
       COALESCE((SELECT sum(pg_column_size(c)) FROM ai_conversations c WHERE c.tenant_id=$1 AND c.user_id=$2),0)
       + COALESCE((SELECT sum(pg_column_size(m)) FROM ai_messages m WHERE m.tenant_id=$1 AND m.user_id=$2),0)
       + COALESCE((SELECT sum(CASE WHEN attachment->>'size' ~ '^[0-9]+$'
                                     THEN (attachment->>'size')::bigint ELSE 0 END)
           FROM ai_messages m
           CROSS JOIN LATERAL jsonb_array_elements(COALESCE(m.attachments,'[]'::jsonb)) attachment
          WHERE m.tenant_id=$1 AND m.user_id=$2),0)
       + COALESCE((SELECT sum(pg_column_size(x)) FROM ai_tool_executions x WHERE x.tenant_id=$1 AND x.user_id=$2),0)
     )::bigint AS "totalBytes",
     (SELECT count(*)::int FROM ai_conversations c WHERE c.tenant_id=$1 AND c.user_id=$2 AND c.status <> 'deleted') AS "conversationCount"`,
    parameters
  ));
  return {
    totalBytes: Math.max(0, Number(result.rows[0]?.totalBytes || 0)),
    conversationCount: Math.max(0, Number(result.rows[0]?.conversationCount || 0))
  };
}

export async function getAIChatStorage(session, { keepConversationId = null } = {}, runner = { query }) {
  const [total, rows] = await Promise.all([
    totalAIChatStorage(session, runner),
    conversationStorageRows(session, runner, keepConversationId)
  ]);
  const keepId = safeConversationId(keepConversationId);
  const newestRetainedId = keepId ? null : [...rows]
    .filter((row) => !row.isPinned && row.status !== "deleted")
    .sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0))[0]?.id;
  const cleanableRows = rows.filter((row) => !row.isPinned && row.id !== newestRetainedId);
  const cleanableBytes = cleanableRows.reduce((sum, row) => sum + rowBytes(row), 0);
  return {
    ...total,
    cleanableBytes,
    cleanableConversations: cleanableRows.length,
    cleanablePercent: total.totalBytes ? Math.round((cleanableBytes / total.totalBytes) * 1000) / 10 : 0,
    keepConversationId: keepId || newestRetainedId || null
  };
}

export async function cleanupAIChatStorage(session, input = {}) {
  const targetBytes = Number(input.targetBytes || 0);
  if (!Number.isFinite(targetBytes) || targetBytes < 1 || targetBytes > MAX_CLEANUP_BYTES) {
    throw Object.assign(new Error("حدد مساحة صالحة تريد إخلاءها."), { status: 400 });
  }
  const rows = await conversationStorageRows(session, { query }, input.keepConversationId);
  const selection = selectAIStorageCleanupCandidates(rows, targetBytes, { keepConversationId: input.keepConversationId });
  const ids = selection.selected.map((row) => row.id);
  for (const conversationId of ids) {
    await deleteObjectsForConversation(session, conversationId);
    await query(
      `DELETE FROM ai_conversations
        WHERE id=$1 AND tenant_id=$2 AND user_id=$3 AND is_pinned=false`,
      [conversationId, session.tenantId, session.userId]
    );
  }
  const storage = await getAIChatStorage(session, { keepConversationId: input.keepConversationId });
  return {
    storage,
    freedBytes: selection.estimatedFreedBytes,
    deletedConversations: ids.length,
    retainedConversationId: selection.retainedConversationId
  };
}
