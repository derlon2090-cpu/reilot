import { query, transaction } from "../db.js";

const MAX_CLEANUP_BYTES = 1024 * 1024 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeConversationId(value) {
  const id = String(value || "").trim();
  return UUID_PATTERN.test(id) ? id : null;
}

function rowBytes(row) {
  return Math.max(0, Number(row?.storageBytes || 0));
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
  const result = await runner.query(
    `SELECT c.id,c.status,c.is_pinned AS "isPinned",c.last_message_at AS "lastMessageAt",
       (pg_column_size(c)
        + COALESCE((SELECT sum(pg_column_size(m)) FROM ai_messages m WHERE m.conversation_id=c.id),0)
        + COALESCE((SELECT sum(pg_column_size(x)) FROM ai_tool_executions x WHERE x.conversation_id=c.id),0))::bigint AS "storageBytes"
       FROM ai_conversations c
      WHERE c.tenant_id=$1 AND c.user_id=$2
        AND ($3::uuid IS NULL OR c.id <> $3::uuid)
      ORDER BY CASE c.status WHEN 'deleted' THEN 0 WHEN 'archived' THEN 1 ELSE 2 END,
               c.last_message_at ASC
      LIMIT 500`,
    [session.tenantId, session.userId, safeConversationId(keepConversationId)]
  );
  return result.rows;
}

async function totalAIChatStorage(session, runner) {
  const result = await runner.query(
    `SELECT (
       COALESCE((SELECT sum(pg_column_size(c)) FROM ai_conversations c WHERE c.tenant_id=$1 AND c.user_id=$2),0)
       + COALESCE((SELECT sum(pg_column_size(m)) FROM ai_messages m WHERE m.tenant_id=$1 AND m.user_id=$2),0)
       + COALESCE((SELECT sum(pg_column_size(x)) FROM ai_tool_executions x WHERE x.tenant_id=$1 AND x.user_id=$2),0)
     )::bigint AS "totalBytes",
     (SELECT count(*)::int FROM ai_conversations c WHERE c.tenant_id=$1 AND c.user_id=$2 AND c.status <> 'deleted') AS "conversationCount"`,
    [session.tenantId, session.userId]
  );
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
  return transaction(async (client) => {
    const rows = await conversationStorageRows(session, client, input.keepConversationId);
    const selection = selectAIStorageCleanupCandidates(rows, targetBytes, { keepConversationId: input.keepConversationId });
    const ids = selection.selected.map((row) => row.id);
    if (ids.length) {
      await client.query(
        `DELETE FROM ai_conversations
          WHERE tenant_id=$1 AND user_id=$2 AND is_pinned=false AND id=ANY($3::uuid[])`,
        [session.tenantId, session.userId, ids]
      );
    }
    const storage = await getAIChatStorage(session, { keepConversationId: input.keepConversationId }, client);
    return {
      storage,
      freedBytes: selection.estimatedFreedBytes,
      deletedConversations: ids.length,
      retainedConversationId: selection.retainedConversationId
    };
  });
}
