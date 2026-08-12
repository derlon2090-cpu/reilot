import { query, transaction } from "./db.js";
import { createInAppNotification } from "./in-app-notifications.js";
import { sendSupportReplyEmail } from "./email/resend.service.js";
import { publishSupportChange } from "./support-events.js";

export const SUPPORT_TYPES = ["INQUIRY","TECHNICAL_ISSUE","SUGGESTION","COMPLAINT","BILLING","INTEGRATION","ACCOUNT","OTHER"];
export const SUPPORT_STATUSES = ["NEW","OPEN","IN_PROGRESS","WAITING_FOR_USER","WAITING_FOR_SUPPORT","RESOLVED","CLOSED","REOPENED"];
export const SUPPORT_PRIORITIES = ["LOW","NORMAL","HIGH","URGENT"];
const SUPPORT_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function cleanSupportText(value, { min, max, label }) {
  const text = String(value || "").replace(/<[^>]*>/g, "").replace(/\r\n?/g, "\n").trim();
  if (text.length < min || text.length > max) throw Object.assign(new Error(`${label} يجب أن يكون بين ${min} و${max} حرفًا.`), { status: 400 });
  return text;
}

export function normalizePublicSupportRequest(input = {}) {
  const name = cleanSupportText(input.name, { min: 2, max: 120, label: "الاسم الكامل" });
  const email = String(input.email || "").trim().toLowerCase();
  if (!SUPPORT_EMAIL_PATTERN.test(email) || email.length > 254) {
    throw Object.assign(new Error("صيغة البريد الإلكتروني غير صحيحة."), { status: 400 });
  }
  const type = SUPPORT_TYPES.includes(input.type) ? input.type : "INQUIRY";
  const subject = cleanSupportText(input.subject, { min: 5, max: 150, label: "عنوان الطلب" });
  const body = cleanSupportText(input.body, { min: 10, max: 2000, label: "تفاصيل الطلب" });
  return { name, email, type, subject, body };
}

function pageArgs(input) {
  return { page: Math.max(1, Number(input.page || 1)), limit: Math.min(50, Math.max(1, Number(input.limit || 20))) };
}

async function enforceRate(client, { tenantId, userId, kind }) {
  const condition = kind === "ticket"
    ? `t.created_at > now() - interval '1 hour'`
    : `m.created_at > now() - interval '10 minutes'`;
  const sql = kind === "ticket"
    ? `SELECT count(*)::int AS count FROM support_tickets t WHERE t.tenant_id=$1 AND t.created_by_user_id=$2 AND ${condition}`
    : `SELECT count(*)::int AS count FROM support_ticket_messages m WHERE m.tenant_id=$1 AND m.sender_user_id=$2 AND ${condition}`;
  const result = await client.query(sql, [tenantId, userId]);
  const cap = kind === "ticket" ? 5 : 20;
  if (result.rows[0].count >= cap) throw Object.assign(new Error("تم تجاوز عدد المحاولات المسموح مؤقتًا. حاول لاحقًا."), { status: 429 });
}

const selectTicket = `
  SELECT t.id, t.ticket_number AS "ticketNumber", t.tenant_id AS "tenantId",
         t.created_by_user_id AS "createdByUserId", t.requester_email AS "requesterEmail",
         t.requester_name AS "requesterName",
         t.type, t.subject, t.status, t.priority, t.assigned_admin_user_id AS "assignedAdminUserId",
         t.user_unread_count AS "userUnreadCount", t.admin_unread_count AS "adminUnreadCount",
         t.last_user_message_at AS "lastUserMessageAt", t.last_admin_message_at AS "lastAdminMessageAt",
         t.resolved_at AS "resolvedAt", t.closed_at AS "closedAt", t.created_at AS "createdAt", t.updated_at AS "updatedAt"`;

export async function createTicket(session, input) {
  const type = SUPPORT_TYPES.includes(input.type) ? input.type : "INQUIRY";
  const subject = cleanSupportText(input.subject, { min: 5, max: 150, label: "عنوان الرسالة" });
  const body = cleanSupportText(input.body, { min: 10, max: 2000, label: "تفاصيل الرسالة" });
  return transaction(async (client) => {
    await enforceRate(client, { tenantId: session.tenantId, userId: session.userId, kind: "ticket" });
    const seq = await client.query("SELECT nextval('support_ticket_number_seq') AS value");
    const ticketNumber = `SUP-${new Date().getUTCFullYear()}-${String(seq.rows[0].value).padStart(6, "0")}`;
    const created = await client.query(
      `INSERT INTO support_tickets (ticket_number,tenant_id,created_by_user_id,requester_email,type,subject)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [ticketNumber, session.tenantId, session.userId, session.email, type, subject]
    );
    const ticketId = created.rows[0].id;
    const message = await client.query(
      `INSERT INTO support_ticket_messages (ticket_id,tenant_id,sender_type,sender_user_id,body)
       VALUES ($1,$2,'USER',$3,$4) RETURNING id`,
      [ticketId, session.tenantId, session.userId, body]
    );
    await client.query(
      `INSERT INTO support_ticket_status_history (ticket_id,tenant_id,to_status,changed_by_type,changed_by_user_id,reason)
       VALUES ($1,$2,'NEW','USER',$3,'ticket_created')`,
      [ticketId, session.tenantId, session.userId]
    );
    await publishSupportChange(client, {
      kind: "ticket-created", ticketId, tenantId: session.tenantId, userId: session.userId, status: "NEW"
    });
    return { id: ticketId, messageId: message.rows[0].id, ticketNumber };
  });
}

export async function createPublicTicket(input, { requestFingerprint = "" } = {}) {
  const normalized = normalizePublicSupportRequest(input);
  const fingerprint = String(requestFingerprint || "").slice(0, 128);
  return transaction(async (client) => {
    const recent = await client.query(
      `SELECT count(*)::int AS count
         FROM support_tickets
        WHERE source='public_support'
          AND created_at > now() - interval '1 hour'
          AND (
            lower(requester_email)=$1
            OR ($2 <> '' AND metadata->>'requestFingerprint'=$2)
          )`,
      [normalized.email, fingerprint]
    );
    if (Number(recent.rows[0]?.count || 0) >= 3) {
      throw Object.assign(new Error("تم تجاوز عدد طلبات الدعم المسموح مؤقتًا. حاول لاحقًا."), { status: 429 });
    }
    const seq = await client.query("SELECT nextval('support_ticket_number_seq') AS value");
    const ticketNumber = `SUP-${new Date().getUTCFullYear()}-${String(seq.rows[0].value).padStart(6, "0")}`;
    const created = await client.query(
      `INSERT INTO support_tickets
        (ticket_number,tenant_id,created_by_user_id,requester_email,requester_name,type,subject,source,metadata)
       VALUES ($1,NULL,NULL,$2,$3,$4,$5,'public_support',$6::jsonb)
       RETURNING id`,
      [
        ticketNumber,
        normalized.email,
        normalized.name,
        normalized.type,
        normalized.subject,
        JSON.stringify(fingerprint ? { requestFingerprint: fingerprint } : {})
      ]
    );
    const ticketId = created.rows[0].id;
    const message = await client.query(
      `INSERT INTO support_ticket_messages
        (ticket_id,tenant_id,sender_type,sender_user_id,body)
       VALUES ($1,NULL,'USER',NULL,$2)
       RETURNING id`,
      [ticketId, normalized.body]
    );
    await client.query(
      `INSERT INTO support_ticket_status_history
        (ticket_id,tenant_id,to_status,changed_by_type,reason)
       VALUES ($1,NULL,'NEW','USER','public_ticket_created')`,
      [ticketId]
    );
    await publishSupportChange(client, { kind: "ticket-created", ticketId, status: "NEW" });
    return {
      id: ticketId,
      messageId: message.rows[0].id,
      ticketNumber,
      requesterEmail: normalized.email
    };
  });
}

export async function listUserTickets(session, input = {}) {
  const { page, limit } = pageArgs(input);
  const filter = String(input.filter || "all");
  const statusSql = filter === "new" ? "AND t.status IN ('NEW','OPEN','IN_PROGRESS','WAITING_FOR_SUPPORT','REOPENED')"
    : filter === "replied" ? "AND t.status='WAITING_FOR_USER'"
    : filter === "closed" ? "AND t.status IN ('RESOLVED','CLOSED')" : "";
  const [rows, counts] = await Promise.all([
    query(`${selectTicket},
      (SELECT body FROM support_ticket_messages m WHERE m.ticket_id=t.id AND NOT m.is_internal_note ORDER BY m.created_at DESC LIMIT 1) AS "lastMessage"
      FROM support_tickets t WHERE t.tenant_id=$1 AND t.created_by_user_id=$2 ${statusSql}
      ORDER BY t.updated_at DESC LIMIT $3 OFFSET $4`, [session.tenantId, session.userId, limit, (page - 1) * limit]),
    query(`SELECT count(*)::int AS total,
      count(*) FILTER (WHERE status IN ('NEW','OPEN','IN_PROGRESS','WAITING_FOR_SUPPORT','REOPENED'))::int AS new,
      count(*) FILTER (WHERE status='WAITING_FOR_USER')::int AS replied,
      count(*) FILTER (WHERE status IN ('RESOLVED','CLOSED'))::int AS closed
      FROM support_tickets WHERE tenant_id=$1 AND created_by_user_id=$2`, [session.tenantId, session.userId])
  ]);
  return { items: rows.rows, counts: counts.rows[0], page, limit };
}

export async function getUserTicket(session, ticketId, includeInternal = false) {
  const ticket = await query(`${selectTicket} FROM support_tickets t WHERE t.id=$1 AND t.tenant_id=$2 AND t.created_by_user_id=$3 LIMIT 1`, [ticketId, session.tenantId, session.userId]);
  if (!ticket.rows[0]) return null;
  const messages = await query(
    `SELECT m.id,m.sender_type AS "senderType",m.body,m.is_internal_note AS "isInternalNote",m.created_at AS "createdAt",
      COALESCE(u.name,auu.name,CASE WHEN m.sender_type='SYSTEM' THEN 'النظام' ELSE 'فريق الدعم' END) AS "senderName"
      FROM support_ticket_messages m LEFT JOIN users u ON u.id=m.sender_user_id
      LEFT JOIN admin_users au ON au.id=m.sender_admin_user_id LEFT JOIN users auu ON auu.id=au.user_id
      WHERE m.ticket_id=$1 ${includeInternal ? "" : "AND NOT m.is_internal_note"} ORDER BY m.created_at`, [ticketId]
  );
  const attachments = await query(`SELECT id,message_id AS "messageId",original_name AS "originalName",content_type AS "contentType",size_bytes AS "sizeBytes",storage_url AS "url" FROM support_ticket_attachments WHERE ticket_id=$1 ORDER BY created_at`, [ticketId]);
  return { ...ticket.rows[0], messages: messages.rows, attachments: attachments.rows };
}

export async function assertUserTicketAttachmentAccess(session, ticketId, files) {
  const ticket = await query(
    `SELECT t.id,
      (SELECT count(*)::int FROM support_ticket_attachments a WHERE a.ticket_id=t.id) AS "attachmentCount",
      (SELECT COALESCE(sum(a.size_bytes),0)::bigint FROM support_ticket_attachments a WHERE a.ticket_id=t.id) AS "attachmentBytes",
      (SELECT count(*)::int FROM support_ticket_attachments a
        WHERE a.tenant_id=t.tenant_id AND a.created_by_user_id=t.created_by_user_id
          AND a.created_at > now() - interval '1 hour') AS "recentUploads"
     FROM support_tickets t
     WHERE t.id=$1 AND t.tenant_id=$2 AND t.created_by_user_id=$3`,
    [ticketId, session.tenantId, session.userId]
  );
  if (!ticket.rows[0]) throw Object.assign(new Error("التذكرة غير موجودة."), { status: 404 });
  const incomingBytes = files.reduce((sum, file) => sum + Number(file.size || 0), 0);
  if (Number(ticket.rows[0].attachmentCount || 0) + files.length > 5) {
    throw Object.assign(new Error("الحد الأقصى خمسة مرفقات لكل تذكرة."), { status: 400 });
  }
  if (Number(ticket.rows[0].attachmentBytes || 0) + incomingBytes > 25 * 1024 * 1024) {
    throw Object.assign(new Error("إجمالي المرفقات يجب ألا يتجاوز 25 ميجابايت."), { status: 400 });
  }
  if (Number(ticket.rows[0].recentUploads || 0) + files.length > 10) {
    throw Object.assign(new Error("تجاوزت حد رفع المرفقات مؤقتًا. حاول لاحقًا."), { status: 429 });
  }
  return ticket.rows[0];
}

export async function saveUserTicketAttachment(session, ticketId, input) {
  const result = await query(
    `INSERT INTO support_ticket_attachments
      (tenant_id,ticket_id,message_id,storage_url,storage_path,original_name,content_type,size_bytes,sha256,created_by_user_id)
     SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
     WHERE EXISTS (
       SELECT 1 FROM support_tickets
       WHERE id=$2 AND tenant_id=$1 AND created_by_user_id=$10
     )
     AND (
       $3::uuid IS NULL OR EXISTS (
         SELECT 1 FROM support_ticket_messages
         WHERE id=$3 AND ticket_id=$2 AND tenant_id=$1 AND sender_user_id=$10
       )
     )
     RETURNING id`,
    [
      session.tenantId, ticketId, input.messageId || null, input.url, input.path,
      input.originalName, input.contentType, input.sizeBytes, input.sha256, session.userId
    ]
  );
  if (!result.rows[0]) throw Object.assign(new Error("التذكرة غير موجودة."), { status: 404 });
  return result.rows[0];
}

export async function userReply(session, ticketId, input) {
  const body = cleanSupportText(input.body, { min: 2, max: 2000, label: "الرد" });
  return transaction(async (client) => {
    await enforceRate(client, { tenantId: session.tenantId, userId: session.userId, kind: "reply" });
    const locked = await client.query(`SELECT * FROM support_tickets WHERE id=$1 AND tenant_id=$2 AND created_by_user_id=$3 FOR UPDATE`, [ticketId, session.tenantId, session.userId]);
    const ticket = locked.rows[0];
    if (!ticket) throw Object.assign(new Error("التذكرة غير موجودة."), { status: 404 });
    if (ticket.status === "CLOSED") throw Object.assign(new Error("هذه التذكرة مغلقة."), { status: 409 });
    const message = await client.query(`INSERT INTO support_ticket_messages(ticket_id,tenant_id,sender_type,sender_user_id,body) VALUES($1,$2,'USER',$3,$4) RETURNING id`, [ticketId, session.tenantId, session.userId, body]);
    const next = ticket.status === "RESOLVED" ? "REOPENED" : "WAITING_FOR_SUPPORT";
    await client.query(`UPDATE support_tickets SET status=$2,admin_unread_count=admin_unread_count+1,last_user_message_at=now(),updated_at=now(),reopened_at=CASE WHEN $2='REOPENED' THEN now() ELSE reopened_at END WHERE id=$1`, [ticketId, next]);
    await publishSupportChange(client, {
      kind: "message", ticketId, tenantId: session.tenantId, userId: session.userId, status: next
    });
    return { id: message.rows[0].id, status: next };
  });
}

export async function markUserRead(session, ticketId) {
  const result = await query(`UPDATE support_tickets SET user_unread_count=0 WHERE id=$1 AND tenant_id=$2 AND created_by_user_id=$3 RETURNING id`, [ticketId, session.tenantId, session.userId]);
  if (!result.rows[0]) return false;
  await query(`UPDATE support_ticket_messages SET read_by_user_at=COALESCE(read_by_user_at,now()) WHERE ticket_id=$1 AND sender_type='ADMIN' AND NOT is_internal_note`, [ticketId]);
  return true;
}

export async function reopenUserTicket(session, ticketId) {
  return transaction(async (client) => {
    const locked = await client.query(
      `SELECT id,status,resolved_at FROM support_tickets
       WHERE id=$1 AND tenant_id=$2 AND created_by_user_id=$3 FOR UPDATE`,
      [ticketId, session.tenantId, session.userId]
    );
    const ticket = locked.rows[0];
    if (!ticket) throw Object.assign(new Error("التذكرة غير موجودة."), { status: 404 });
    if (ticket.status !== "RESOLVED") throw Object.assign(new Error("يمكن إعادة فتح التذاكر المحلولة فقط."), { status: 409 });
    if (ticket.resolved_at && Date.now() - new Date(ticket.resolved_at).getTime() > 14 * 86_400_000) {
      throw Object.assign(new Error("انتهت مهلة إعادة فتح هذه التذكرة."), { status: 409 });
    }
    await client.query(
      `UPDATE support_tickets SET status='REOPENED',admin_unread_count=admin_unread_count+1,reopened_at=now(),updated_at=now()
       WHERE id=$1`,
      [ticketId]
    );
    await client.query(
      `INSERT INTO support_ticket_status_history(ticket_id,tenant_id,from_status,to_status,changed_by_type,changed_by_user_id,reason)
       VALUES($1,$2,'RESOLVED','REOPENED','USER',$3,'user_reopened')`,
      [ticketId, session.tenantId, session.userId]
    );
    await publishSupportChange(client, {
      kind: "status", ticketId, tenantId: session.tenantId, userId: session.userId, status: "REOPENED"
    });
    return { id: ticketId, status: "REOPENED" };
  });
}

export async function closeUserTicket(session, ticketId) {
  return transaction(async (client) => {
    const locked = await client.query(
      `SELECT id,status FROM support_tickets
       WHERE id=$1 AND tenant_id=$2 AND created_by_user_id=$3 FOR UPDATE`,
      [ticketId, session.tenantId, session.userId]
    );
    const ticket = locked.rows[0];
    if (!ticket) throw Object.assign(new Error("التذكرة غير موجودة."), { status: 404 });
    if (ticket.status === "CLOSED") return { id: ticketId, status: "CLOSED" };
    const closed = await client.query(
      `UPDATE support_tickets
       SET status='CLOSED',closed_at=now(),updated_at=now(),user_unread_count=0,
           admin_unread_count=admin_unread_count+1
       WHERE id=$1 RETURNING id,status`,
      [ticketId]
    );
    await client.query(
      `INSERT INTO support_ticket_status_history
        (ticket_id,tenant_id,from_status,to_status,changed_by_type,changed_by_user_id,reason)
       VALUES($1,$2,$3,'CLOSED','USER',$4,'user_closed')`,
      [ticketId, session.tenantId, ticket.status, session.userId]
    );
    await publishSupportChange(client, {
      kind: "status", ticketId, tenantId: session.tenantId, userId: session.userId, status: "CLOSED"
    });
    return closed.rows[0];
  });
}

export async function adminListTickets(input = {}) {
  const { page, limit } = pageArgs(input);
  const status = SUPPORT_STATUSES.includes(input.status) ? input.status : "";
  const priority = SUPPORT_PRIORITIES.includes(input.priority) ? input.priority : "";
  const type = SUPPORT_TYPES.includes(input.type) ? input.type : "";
  const search = String(input.search || "").trim();
  const where = ["1=1"]; const values = [];
  if (status) { values.push(status); where.push(`t.status=$${values.length}`); }
  if (priority) { values.push(priority); where.push(`t.priority=$${values.length}`); }
  if (type) { values.push(type); where.push(`t.type=$${values.length}`); }
  if (search) { values.push(`%${search}%`); where.push(`(t.subject ILIKE $${values.length} OR t.ticket_number ILIKE $${values.length} OR t.requester_email ILIKE $${values.length} OR t.requester_name ILIKE $${values.length} OR u.email ILIKE $${values.length} OR u.name ILIKE $${values.length})`); }
  values.push(limit, (page - 1) * limit);
  const rows = await query(`${selectTicket},COALESCE(u.name,t.requester_name,'زائر الموقع') AS "requesterName",
    COALESCE(u.email,t.requester_email) AS "requesterEmail",COALESCE(tn.name,'زائر الموقع') AS "tenantName",
    auu.name AS "assignedAdminName",
    (SELECT body FROM support_ticket_messages m WHERE m.ticket_id=t.id AND NOT m.is_internal_note ORDER BY m.created_at DESC LIMIT 1) AS "lastMessage"
    FROM support_tickets t LEFT JOIN users u ON u.id=t.created_by_user_id LEFT JOIN tenants tn ON tn.id=t.tenant_id
    LEFT JOIN admin_users au ON au.id=t.assigned_admin_user_id LEFT JOIN users auu ON auu.id=au.user_id
    WHERE ${where.join(" AND ")} ORDER BY
      CASE t.priority WHEN 'URGENT' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'NORMAL' THEN 3 ELSE 4 END,t.updated_at DESC
    LIMIT $${values.length-1} OFFSET $${values.length}`, values);
  const stats = await query(`SELECT count(*)::int AS total,
    count(*) FILTER(WHERE status IN('NEW','OPEN'))::int AS open,
    count(*) FILTER(WHERE status='WAITING_FOR_USER')::int AS replied,
    count(*) FILTER(WHERE status IN('IN_PROGRESS','WAITING_FOR_SUPPORT','REOPENED'))::int AS pending
    FROM support_tickets`);
  return { items: rows.rows, stats: stats.rows[0], page, limit };
}

export async function getAdminTicket(ticketId) {
  const ticket = await query(`${selectTicket},COALESCE(u.name,t.requester_name,'زائر الموقع') AS "requesterName",
    COALESCE(tn.name,'زائر الموقع') AS "tenantName",auu.name AS "assignedAdminName"
    FROM support_tickets t LEFT JOIN users u ON u.id=t.created_by_user_id LEFT JOIN tenants tn ON tn.id=t.tenant_id
    LEFT JOIN admin_users au ON au.id=t.assigned_admin_user_id LEFT JOIN users auu ON auu.id=au.user_id
    WHERE t.id=$1 LIMIT 1`, [ticketId]);
  if (!ticket.rows[0]) return null;
  const messages = await query(`SELECT m.id,m.sender_type AS "senderType",m.body,m.is_internal_note AS "isInternalNote",
    m.email_delivery_status AS "emailDeliveryStatus",m.email_sent_at AS "emailSentAt",m.created_at AS "createdAt",
    COALESCE(u.name,auu.name,'النظام') AS "senderName" FROM support_ticket_messages m
    LEFT JOIN users u ON u.id=m.sender_user_id LEFT JOIN admin_users au ON au.id=m.sender_admin_user_id LEFT JOIN users auu ON auu.id=au.user_id
    WHERE m.ticket_id=$1 ORDER BY m.created_at`, [ticketId]);
  const attachments = await query(
    `SELECT id,message_id AS "messageId",original_name AS "originalName",content_type AS "contentType",
      size_bytes AS "sizeBytes",storage_url AS "url"
     FROM support_ticket_attachments WHERE ticket_id=$1 ORDER BY created_at`,
    [ticketId]
  );
  return { ...ticket.rows[0], messages: messages.rows, attachments: attachments.rows };
}

export async function markAdminRead(ticketId) {
  return transaction(async (client) => {
    const ticket = await client.query(
      `UPDATE support_tickets SET admin_unread_count=0
       WHERE id=$1 RETURNING id`,
      [ticketId]
    );
    if (!ticket.rows[0]) return false;
    await client.query(
      `UPDATE support_ticket_messages
       SET read_by_admin_at=COALESCE(read_by_admin_at,now())
       WHERE ticket_id=$1 AND sender_type='USER'`,
      [ticketId]
    );
    return true;
  });
}

export async function adminReply(admin, ticketId, input) {
  const body = cleanSupportText(input.body, { min: 2, max: 2000, label: "الرد" });
  const internal = Boolean(input.internal);
  const result = await transaction(async (client) => {
    const locked = await client.query(`SELECT * FROM support_tickets WHERE id=$1 FOR UPDATE`, [ticketId]);
    const ticket = locked.rows[0];
    if (!ticket) throw Object.assign(new Error("التذكرة غير موجودة."), { status: 404 });
    const message = await client.query(`INSERT INTO support_ticket_messages
      (ticket_id,tenant_id,sender_type,sender_admin_user_id,body,is_internal_note,email_delivery_status)
      VALUES($1,$2,'ADMIN',$3,$4,$5,$6) RETURNING id`,
      [ticketId,ticket.tenant_id,admin.adminId,body,internal,internal ? "not_required" : "pending"]);
    if (!internal) await client.query(`UPDATE support_tickets SET status='WAITING_FOR_USER',user_unread_count=user_unread_count+1,admin_unread_count=0,last_admin_message_at=now(),first_response_at=COALESCE(first_response_at,now()),updated_at=now() WHERE id=$1`, [ticketId]);
    await publishSupportChange(client, {
      kind: internal ? "internal-note" : "message",
      ticketId,
      tenantId: ticket.tenant_id,
      userId: ticket.created_by_user_id,
      status: internal ? ticket.status : "WAITING_FOR_USER",
      internal
    });
    return { id: message.rows[0].id, ticket };
  });
  let emailDelivery = { status: "not_required" };
  if (!internal) {
    if (result.ticket.tenant_id && result.ticket.created_by_user_id) {
      await createInAppNotification({
        tenantId: result.ticket.tenant_id,
        userId: result.ticket.created_by_user_id,
        type: "support_reply",
        title: "تم الرد على رسالتك",
        message: body.slice(0, 180),
        entityType: "support_ticket",
        entityId: ticketId,
        actionUrl: `/dashboard/support?ticket=${ticketId}`,
        dedupeKey: `support-reply:${result.id}`
      });
    }
    try {
      const provider = await sendSupportReplyEmail({
        to: result.ticket.requester_email,
        requesterName: result.ticket.requester_name,
        ticketNumber: result.ticket.ticket_number,
        ticketSubject: result.ticket.subject,
        replyBody: body
      });
      await query(
        `UPDATE support_ticket_messages
            SET email_delivery_status='sent',email_provider_id=$2,email_sent_at=now(),email_last_error=NULL
          WHERE id=$1`,
        [result.id, provider?.id || null]
      );
      emailDelivery = { status: "sent", providerId: provider?.id || null };
    } catch (error) {
      const message = String(error?.message || "email_delivery_failed").slice(0, 500);
      await query(
        `UPDATE support_ticket_messages
            SET email_delivery_status='failed',email_last_error=$2
          WHERE id=$1`,
        [result.id, message]
      );
      emailDelivery = { status: "failed" };
    }
  }
  return { ...result, emailDelivery };
}

export async function updateAdminTicket(admin, ticketId, input) {
  return transaction(async (client) => {
    const locked = await client.query("SELECT * FROM support_tickets WHERE id=$1 FOR UPDATE", [ticketId]);
    const current = locked.rows[0];
    if (!current) throw Object.assign(new Error("التذكرة غير موجودة."), { status:404 });
    const fields=[]; const values=[];
    if (SUPPORT_STATUSES.includes(input.status)) { values.push(input.status); fields.push(`status=$${values.length}`); }
    if (SUPPORT_PRIORITIES.includes(input.priority)) { values.push(input.priority); fields.push(`priority=$${values.length}`); }
    if (Object.hasOwn(input,"assignedAdminUserId")) { values.push(input.assignedAdminUserId || null); fields.push(`assigned_admin_user_id=$${values.length}`); }
    if (!fields.length) throw Object.assign(new Error("لا توجد تغييرات صالحة."), { status:400 });
    const nextStatus = SUPPORT_STATUSES.includes(input.status) ? input.status : null;
    values.push(nextStatus);
    const statusParam = `$${values.length}`;
    values.push(ticketId);
    const result = await client.query(`UPDATE support_tickets SET ${fields.join(",")},updated_at=now(),
      resolved_at=CASE WHEN ${statusParam}='RESOLVED' THEN now() ELSE resolved_at END,
      closed_at=CASE WHEN ${statusParam}='CLOSED' THEN now() ELSE closed_at END
      WHERE id=$${values.length} RETURNING *`, values);
    if (nextStatus && nextStatus !== current.status) {
      await client.query(
        `INSERT INTO support_ticket_status_history(ticket_id,tenant_id,from_status,to_status,changed_by_type,changed_by_admin_user_id,reason)
         VALUES($1,$2,$3,$4,'ADMIN',$5,'admin_status_update')`,
        [ticketId, current.tenant_id, current.status, nextStatus, admin.adminId]
      );
    }
    await publishSupportChange(client, {
      kind: "ticket-updated",
      ticketId,
      tenantId: current.tenant_id,
      userId: current.created_by_user_id,
      status: nextStatus || current.status
    });
    return result.rows[0];
  });
}
