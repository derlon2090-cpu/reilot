import { query, transaction } from "../db.js";
import { deleteObjectsForConversation } from "../attachments/service.js";

function compactTitle(value = "") {
  const normalized = String(value).replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return "محادثة جديدة";
  const words = normalized.split(" ").slice(0, 6).join(" ");
  return words.length > 64 ? `${words.slice(0, 61)}…` : words;
}

export async function listAIConversations(session, { search = "", limit = 40 } = {}) {
  const values = [session.tenantId, session.userId];
  let searchSql = "";
  const term = String(search || "").trim();
  if (term) {
    values.push(`%${term}%`);
    searchSql = `AND (c.title ILIKE $3 OR EXISTS (SELECT 1 FROM ai_messages m WHERE m.conversation_id=c.id AND m.content ILIKE $3))`;
  }
  values.push(Math.min(60, Math.max(1, Number(limit) || 40)));
  const result = await query(
    `WITH selected AS MATERIALIZED (
       SELECT c.id,c.title,c.status,c.is_pinned,c.last_message_at,c.created_at,pg_column_size(c)::bigint AS conversation_bytes
         FROM ai_conversations c
        WHERE c.tenant_id=$1 AND c.user_id=$2 AND c.status='active' ${searchSql}
        ORDER BY c.is_pinned DESC,c.last_message_at DESC
        LIMIT $${values.length}
     ), message_stats AS (
       SELECT m.conversation_id,sum(pg_column_size(m))::bigint AS message_bytes
         FROM ai_messages m JOIN selected s ON s.id=m.conversation_id
        GROUP BY m.conversation_id
     ), attachment_stats AS (
       SELECT a.conversation_id,sum(a.size_bytes)::bigint AS attachment_bytes
         FROM ai_attachments a JOIN selected s ON s.id=a.conversation_id
        GROUP BY a.conversation_id
     ), tool_stats AS (
       SELECT x.conversation_id,sum(pg_column_size(x))::bigint AS tool_bytes
         FROM ai_tool_executions x JOIN selected s ON s.id=x.conversation_id
        GROUP BY x.conversation_id
     )
     SELECT s.id,s.title,s.status,s.is_pinned AS "isPinned",s.last_message_at AS "lastMessageAt",s.created_at AS "createdAt",
            (s.conversation_bytes+COALESCE(m.message_bytes,0)+COALESCE(a.attachment_bytes,0)+COALESCE(t.tool_bytes,0))::bigint AS "storageBytes"
       FROM selected s
       LEFT JOIN message_stats m ON m.conversation_id=s.id
       LEFT JOIN attachment_stats a ON a.conversation_id=s.id
       LEFT JOIN tool_stats t ON t.conversation_id=s.id
      ORDER BY s.is_pinned DESC,s.last_message_at DESC`,
    values
  );
  return result.rows;
}

export async function createAIConversation(session, input = {}) {
  const title = compactTitle(input.title || input.prompt);
  const result = await query(
    `INSERT INTO ai_conversations(tenant_id,user_id,title,metadata)
     VALUES($1,$2,$3,$4::jsonb)
     RETURNING id,title,status,is_pinned AS "isPinned",last_message_at AS "lastMessageAt",created_at AS "createdAt"`,
    [session.tenantId, session.userId, title, JSON.stringify({ page: String(input.page || "support_ai").slice(0, 80) })]
  );
  return result.rows[0];
}

export async function getAIConversation(session, conversationId, { limit = 40 } = {}) {
  const conversation = await query(
    `SELECT id,title,status,is_pinned AS "isPinned",summary,last_message_at AS "lastMessageAt",created_at AS "createdAt"
     FROM ai_conversations WHERE id=$1 AND tenant_id=$2 AND user_id=$3 AND status <> 'deleted' LIMIT 1`,
    [conversationId, session.tenantId, session.userId]
  );
  if (!conversation.rows[0]) return null;
  const messageLimit = Math.min(60, Math.max(10, Number(limit) || 40));
  const messages = await query(
    `SELECT id,role,content,segments,attachments,status,model,provider,"createdAt"
       FROM (
         SELECT id,role,content,segments,attachments,status,model,provider,created_at AS "createdAt"
           FROM ai_messages WHERE conversation_id=$1 AND tenant_id=$2 AND user_id=$3
          ORDER BY created_at DESC,id DESC LIMIT $4
       ) recent
      ORDER BY "createdAt" ASC,id ASC`,
    [conversationId, session.tenantId, session.userId, messageLimit]
  );
  return { ...conversation.rows[0], messages: messages.rows };
}

export async function updateAIConversation(session, conversationId, input = {}) {
  const fields = [];
  const values = [];
  if (Object.hasOwn(input, "title")) { values.push(compactTitle(input.title)); fields.push(`title=$${values.length}`); }
  if (Object.hasOwn(input, "isPinned")) { values.push(Boolean(input.isPinned)); fields.push(`is_pinned=$${values.length}`); }
  if (input.status === "archived") { fields.push("status='archived'", "archived_at=now()"); }
  if (input.status === "active") { fields.push("status='active'", "archived_at=NULL"); }
  if (input.status === "deleted") { fields.push("status='deleted'", "deleted_at=now()"); }
  if (!fields.length) throw Object.assign(new Error("لا توجد تغييرات صالحة."), { status: 400 });
  values.push(conversationId, session.tenantId, session.userId);
  const result = await query(
    `UPDATE ai_conversations SET ${fields.join(",")},updated_at=now()
     WHERE id=$${values.length - 2} AND tenant_id=$${values.length - 1} AND user_id=$${values.length}
     RETURNING id,title,status,is_pinned AS "isPinned",last_message_at AS "lastMessageAt"`,
    values
  );
  if (!result.rows[0]) throw Object.assign(new Error("المحادثة غير موجودة."), { status: 404 });
  return result.rows[0];
}

export async function deleteAIConversation(session, conversationId) {
  const deleted = await transaction(async (client) => {
    const scoped = await client.query(
      `SELECT c.id,c.title FROM ai_conversations c
       WHERE c.id=$1 AND c.tenant_id=$2 AND c.user_id=$3 FOR UPDATE`,
      [conversationId, session.tenantId, session.userId]
    );
    if (!scoped.rows[0]) throw Object.assign(new Error("المحادثة غير موجودة."), { status: 404 });
    return scoped.rows[0];
  });
  await deleteObjectsForConversation(session, conversationId);
  await query("DELETE FROM ai_conversations WHERE id=$1 AND tenant_id=$2 AND user_id=$3", [conversationId, session.tenantId, session.userId]);
  return { id: deleted.id, title: deleted.title, status: "deleted" };
}

export async function appendAIMessage(session, conversationId, input) {
  return transaction(async (client) => {
    const scoped = await client.query(
      `SELECT id,title FROM ai_conversations WHERE id=$1 AND tenant_id=$2 AND user_id=$3 AND status <> 'deleted' FOR UPDATE`,
      [conversationId, session.tenantId, session.userId]
    );
    if (!scoped.rows[0]) throw Object.assign(new Error("المحادثة غير موجودة."), { status: 404 });
    const result = await client.query(
      `INSERT INTO ai_messages(conversation_id,tenant_id,user_id,role,content,segments,attachments,status,model,provider)
       VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10)
       RETURNING id,role,content,segments,attachments,status,created_at AS "createdAt"`,
      [conversationId, session.tenantId, session.userId, input.role, String(input.content || ""),
        JSON.stringify(input.segments || []), JSON.stringify(input.attachments || []), input.status || "completed",
        input.model || null, input.provider || null]
    );
    const titleUpdate = scoped.rows[0].title === "محادثة جديدة" && input.role === "user"
      ? ",title=$4" : "";
    const values = titleUpdate
      ? [conversationId, session.tenantId, session.userId, compactTitle(input.content)]
      : [conversationId, session.tenantId, session.userId];
    await client.query(
      `UPDATE ai_conversations SET last_message_at=now(),updated_at=now(),status='active'${titleUpdate}
       WHERE id=$1 AND tenant_id=$2 AND user_id=$3`, values
    );
    return result.rows[0];
  });
}

export async function finishAIMessage(session, messageId, input = {}) {
  const result = await query(
    `UPDATE ai_messages SET content=$4,segments=$5::jsonb,status=$6,model=$7,provider=$8,
       input_tokens=$9,output_tokens=$10,error_code=$11,updated_at=now()
     WHERE id=$1 AND tenant_id=$2 AND user_id=$3
     RETURNING id,content,segments,status,created_at AS "createdAt"`,
    [messageId, session.tenantId, session.userId, String(input.content || ""), JSON.stringify(input.segments || []),
      input.status || "completed", input.model || null, input.provider || null, Number(input.inputTokens || 0),
      Number(input.outputTokens || 0), input.errorCode || null]
  );
  return result.rows[0] || null;
}

export async function recordAIToolExecution(session, input) {
  await query(
    `INSERT INTO ai_tool_executions(conversation_id,message_id,tenant_id,user_id,tool_name,sanitized_input,result_summary,status,duration_ms)
     VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9)`,
    [input.conversationId, input.messageId || null, session.tenantId, session.userId, input.toolName,
      JSON.stringify(input.sanitizedInput || {}), JSON.stringify(input.resultSummary || {}), input.status, Number(input.durationMs || 0)]
  );
}

export async function recordAIUsage(session, input = {}) {
  await query(
    `INSERT INTO ai_usage_daily(tenant_id,user_id,usage_date,model,input_tokens,output_tokens,request_count,tool_calls,error_count,total_latency_ms)
     VALUES($1,$2,current_date,$3,$4,$5,1,$6,$7,$8)
     ON CONFLICT(tenant_id,user_id,usage_date,model) DO UPDATE SET
       input_tokens=ai_usage_daily.input_tokens+EXCLUDED.input_tokens,
       output_tokens=ai_usage_daily.output_tokens+EXCLUDED.output_tokens,
       request_count=ai_usage_daily.request_count+1,tool_calls=ai_usage_daily.tool_calls+EXCLUDED.tool_calls,
       error_count=ai_usage_daily.error_count+EXCLUDED.error_count,total_latency_ms=ai_usage_daily.total_latency_ms+EXCLUDED.total_latency_ms`,
    [session.tenantId, session.userId, input.model || "local", Number(input.inputTokens || 0), Number(input.outputTokens || 0),
      Number(input.toolCalls || 0), input.error ? 1 : 0, Number(input.latencyMs || 0)]
  );
}
