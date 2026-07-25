import { z } from "zod";
import { query, transaction } from "./db.js";

export const PLATFORM_NOTIFICATION_STATUS = Object.freeze({
  DRAFT: "draft",
  VALIDATING: "validating",
  SCHEDULED: "scheduled",
  PREPARING: "preparing",
  PUBLISHING: "publishing",
  PUBLISHED: "published",
  PARTIALLY_PUBLISHED: "partially_published",
  CANCELLED: "cancelled",
  FAILED: "failed",
  ARCHIVED: "archived"
});

const TYPES = ["general", "update", "maintenance", "warning", "security", "billing", "promotion", "action_required"];
const PRIORITIES = ["low", "normal", "high", "critical"];
const AUDIENCES = ["all_users", "active_users", "selected_plans", "selected_stores", "selected_users", "subscription_status", "integration_status", "custom_filter"];
const SURFACES = ["notification_center", "in_app_toast", "top_banner", "blocking_modal"];

const optionalIso = z.string().datetime({ offset: true }).optional().nullable();
const audienceFiltersSchema = z.object({
  userIds: z.array(z.string().uuid()).max(1000).optional(),
  storeIds: z.array(z.string().uuid()).max(1000).optional(),
  planIds: z.array(z.string().uuid()).max(100).optional(),
  subscriptionStatuses: z.array(z.enum(["active", "trial", "expired", "cancelled", "paused"])).max(10).optional(),
  integrationProvider: z.string().trim().max(50).optional(),
  integrationConnected: z.boolean().optional(),
  createdFrom: optionalIso,
  createdTo: optionalIso
}).strict().default({});

export const createPlatformNotificationSchema = z.object({
  title: z.string().trim().min(3, "عنوان الإشعار قصير").max(120),
  body: z.string().trim().min(5, "محتوى الإشعار مطلوب").max(2000),
  notificationType: z.enum(TYPES),
  priority: z.enum(PRIORITIES).default("normal"),
  audienceType: z.enum(AUDIENCES),
  audienceFilters: audienceFiltersSchema,
  deliverySurfaces: z.array(z.enum(SURFACES)).min(1).max(4),
  actionLabel: z.string().trim().max(40).optional().nullable(),
  actionUrl: z.string().trim().max(500).optional().nullable(),
  requireAcknowledgement: z.boolean().default(false),
  dismissible: z.boolean().default(true),
  pinned: z.boolean().default(false),
  expiresAt: optionalIso,
  scheduleMode: z.enum(["draft", "now", "scheduled"]),
  scheduledAt: optionalIso
}).superRefine((data, ctx) => {
  if (data.scheduleMode === "scheduled" && !data.scheduledAt) {
    ctx.addIssue({ code: "custom", path: ["scheduledAt"], message: "حدد تاريخ ووقت الإرسال" });
  }
  if (data.scheduleMode === "scheduled" && data.scheduledAt && new Date(data.scheduledAt) <= new Date()) {
    ctx.addIssue({ code: "custom", path: ["scheduledAt"], message: "يجب أن يكون موعد الإرسال في المستقبل" });
  }
  if (data.deliverySurfaces.includes("blocking_modal") && !["high", "critical"].includes(data.priority)) {
    ctx.addIssue({ code: "custom", path: ["priority"], message: "النافذة الإلزامية تتطلب أولوية عالية أو حرجة" });
  }
  if (data.deliverySurfaces.includes("top_banner") && !data.expiresAt) {
    ctx.addIssue({ code: "custom", path: ["expiresAt"], message: "الشريط العلوي يتطلب تاريخ انتهاء" });
  }
  if (data.actionLabel && !data.actionUrl) {
    ctx.addIssue({ code: "custom", path: ["actionUrl"], message: "أدخل رابط الإجراء" });
  }
});

export function sameOriginRequest(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function validateNotificationActionUrl(value, requestUrl) {
  if (!value) return null;
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || new URL(requestUrl).origin;
  const url = new URL(value, base);
  if (!["http:", "https:"].includes(url.protocol)) throw Object.assign(new Error("UNSUPPORTED_ACTION_URL_PROTOCOL"), { code: "invalid_action_url" });
  if (["localhost", "127.0.0.1", "::1"].includes(url.hostname) && process.env.NODE_ENV === "production") {
    throw Object.assign(new Error("LOCAL_ACTION_URL_FORBIDDEN"), { code: "invalid_action_url" });
  }
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw Object.assign(new Error("ACTION_URL_MUST_USE_HTTPS"), { code: "invalid_action_url" });
  }
  return url.toString();
}

function audienceWhere(audienceType, filters = {}) {
  const values = [];
  const where = ["u.tenant_id IS NOT NULL", "COALESCE(t.status, 'disabled') <> 'disabled'"];
  const add = (value) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (audienceType === "active_users") {
    where.push(`EXISTS (SELECT 1 FROM sessions sx WHERE sx.user_id=u.id AND sx.expires_at > now())`);
  }
  if (audienceType === "selected_users") {
    where.push(`u.id = ANY(${add(filters.userIds || [])}::uuid[])`);
  }
  if (audienceType === "selected_stores") {
    where.push(`EXISTS (SELECT 1 FROM stores s WHERE s.tenant_id=u.tenant_id AND s.id = ANY(${add(filters.storeIds || [])}::uuid[]))`);
  }
  if (audienceType === "selected_plans") {
    where.push(`EXISTS (SELECT 1 FROM platform_subscriptions ps WHERE ps.tenant_id=u.tenant_id AND ps.plan_id = ANY(${add(filters.planIds || [])}::uuid[]))`);
  }
  if (audienceType === "subscription_status") {
    where.push(`EXISTS (SELECT 1 FROM platform_subscriptions ps WHERE ps.tenant_id=u.tenant_id AND ps.status = ANY(${add(filters.subscriptionStatuses || [])}::text[]))`);
  }
  if (audienceType === "integration_status" || audienceType === "custom_filter") {
    if (filters.integrationProvider) {
      const provider = add(filters.integrationProvider);
      if (filters.integrationConnected === false) {
        where.push(`NOT EXISTS (SELECT 1 FROM app_connections ac WHERE ac.tenant_id=u.tenant_id AND ac.provider=${provider} AND ac.status='connected')`);
      } else {
        where.push(`EXISTS (SELECT 1 FROM app_connections ac WHERE ac.tenant_id=u.tenant_id AND ac.provider=${provider} AND ac.status='connected')`);
      }
    }
  }
  if (filters.createdFrom) where.push(`u.created_at >= ${add(filters.createdFrom)}::timestamptz`);
  if (filters.createdTo) where.push(`u.created_at <= ${add(filters.createdTo)}::timestamptz`);
  return { sql: where.join(" AND "), values };
}

export async function estimatePlatformNotificationAudience({ audienceType, audienceFilters = {} }) {
  const audience = audienceWhere(audienceType, audienceFilters);
  const result = await query(
    `SELECT count(*)::int AS eligible
       FROM users u JOIN tenants t ON t.id=u.tenant_id
      WHERE ${audience.sql}`,
    audience.values
  );
  const eligible = Number(result.rows[0]?.eligible || 0);
  return {
    totalMatched: eligible,
    eligible,
    excluded: 0,
    exclusions: { suspended: 0, deleted: 0, invalidTenant: 0, filterMismatch: 0 }
  };
}

export async function listPlatformNotifications({ status = "", search = "", limit = 50, cursor = null } = {}) {
  const values = [];
  const where = ["1=1"];
  if (status && status !== "all") {
    values.push(status);
    where.push(`n.status=$${values.length}`);
  } else {
    where.push("n.status <> 'archived'");
  }
  if (search) {
    values.push(`%${search}%`);
    where.push(`(n.title ILIKE $${values.length} OR n.body ILIKE $${values.length})`);
  }
  if (cursor) {
    values.push(cursor);
    where.push(`n.created_at < $${values.length}::timestamptz`);
  }
  values.push(Math.min(Math.max(Number(limit) || 50, 1), 100));
  const result = await query(
    `SELECT n.id,n.title,n.body,n.notification_type AS "notificationType",n.priority,n.status,
            n.audience_type AS "audienceType",n.delivery_surfaces AS "deliverySurfaces",
            n.scheduled_at AS "scheduledAt",n.published_at AS "publishedAt",n.expires_at AS "expiresAt",
            n.estimated_recipients AS "estimatedRecipients",n.created_recipients AS "createdRecipients",
            n.delivered_count AS "deliveredCount",n.seen_count AS "seenCount",n.read_count AS "readCount",
            n.action_label AS "actionLabel",n.action_url AS "actionUrl",n.created_at AS "createdAt",
            u.name AS "createdBy"
       FROM platform_notifications n
       JOIN admin_users au ON au.id=n.created_by_admin_user_id
       JOIN users u ON u.id=au.user_id
      WHERE ${where.join(" AND ")}
      ORDER BY n.created_at DESC LIMIT $${values.length}`,
    values
  );
  const summary = await query(
    `SELECT count(*) FILTER(WHERE status='scheduled')::int AS scheduled,
            count(*) FILTER(WHERE status='draft')::int AS drafts,
            count(*) FILTER(WHERE published_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Riyadh'))::int AS "publishedToday",
            COALESCE(sum(created_recipients) FILTER(WHERE status IN ('published','partially_published')),0)::int AS recipients
       FROM platform_notifications WHERE status <> 'archived'`
  );
  return { items: result.rows, summary: summary.rows[0], nextCursor: result.rows.length ? result.rows.at(-1).createdAt : null };
}

export async function createPlatformNotification({ input, admin, requestUrl }) {
  const actionUrl = validateNotificationActionUrl(input.actionUrl, requestUrl);
  const estimate = await estimatePlatformNotificationAudience(input);
  const status = input.scheduleMode === "draft" ? "draft" : input.scheduleMode === "scheduled" ? "scheduled" : "validating";
  return transaction(async (client) => {
    const created = await client.query(
      `INSERT INTO platform_notifications
         (title,body,notification_type,priority,status,audience_type,audience_filters,delivery_surfaces,
          action_label,action_url,require_acknowledgement,dismissible,pinned,scheduled_at,expires_at,
          estimated_recipients,eligible_recipients,created_by_admin_user_id,updated_by_admin_user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11,$12,$13,$14,$15,$16,$16,$17,$17)
       RETURNING id,status,created_at AS "createdAt"`,
      [
        input.title, input.body, input.notificationType, input.priority, status, input.audienceType,
        JSON.stringify(input.audienceFilters || {}), JSON.stringify(input.deliverySurfaces),
        input.actionLabel || null, actionUrl, input.requireAcknowledgement, input.dismissible, input.pinned,
        input.scheduleMode === "scheduled" ? input.scheduledAt : null, input.expiresAt || null,
        estimate.eligible, admin.adminId
      ]
    );
    const notification = created.rows[0];
    if (status !== "draft") {
      await client.query(
        `INSERT INTO platform_notification_outbox
           (notification_id,event_type,idempotency_key,available_at)
         VALUES ($1,'platform_notification.publish',$2,$3)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [notification.id, `platform-notification:${notification.id}:publish:v1`, input.scheduleMode === "scheduled" ? input.scheduledAt : new Date()]
      );
    }
    return { notification, estimate };
  });
}

async function materializeAudienceBatch(client, notification, cursor, limit = 500) {
  const audience = audienceWhere(notification.audience_type, notification.audience_filters || {});
  const values = [...audience.values];
  let cursorSql = "";
  if (cursor) {
    values.push(cursor);
    cursorSql = ` AND u.id > $${values.length}::uuid`;
  }
  values.push(limit);
  const users = await client.query(
    `SELECT u.id,u.tenant_id
       FROM users u JOIN tenants t ON t.id=u.tenant_id
      WHERE ${audience.sql}${cursorSql}
      ORDER BY u.id LIMIT $${values.length}`,
    values
  );
  if (!users.rows.length) return { count: 0, lastCursor: cursor };
  const ids = users.rows.map((row) => row.id);
  const tenants = users.rows.map((row) => row.tenant_id);
  const inserted = await client.query(
    `INSERT INTO platform_notification_recipients
       (notification_id,user_id,tenant_id,delivery_status,delivered_at)
     SELECT $1, x.user_id, x.tenant_id, 'available', now()
       FROM unnest($2::uuid[],$3::uuid[]) AS x(user_id,tenant_id)
     ON CONFLICT (notification_id,user_id) DO NOTHING
     RETURNING id`,
    [notification.id, ids, tenants]
  );
  return { count: inserted.rowCount, lastCursor: users.rows.at(-1).id, scanned: users.rowCount };
}

export async function runPlatformNotificationWorker({ maxNotifications = 10, batchSize = 500 } = {}) {
  await query(
    `UPDATE platform_notification_outbox o
        SET status='pending',available_at=now(),failure_code=NULL
      FROM platform_notifications n
      WHERE o.notification_id=n.id AND o.status='failed' AND o.attempts < 5 AND o.available_at <= now()
        AND n.status IN ('validating','scheduled','preparing','publishing','failed','partially_published')`
  );
  const due = await transaction(async (client) => client.query(
    `WITH claimed AS (
       SELECT o.id
         FROM platform_notification_outbox o
         JOIN platform_notifications n ON n.id=o.notification_id
        WHERE o.status='pending' AND o.available_at <= now()
          AND n.status IN ('validating','scheduled','preparing','publishing','failed','partially_published')
        ORDER BY o.available_at
        FOR UPDATE OF o SKIP LOCKED
        LIMIT $1
     )
     UPDATE platform_notification_outbox o
        SET status='processing',attempts=o.attempts+1
       FROM claimed,platform_notifications n
      WHERE o.id=claimed.id AND n.id=o.notification_id
      RETURNING o.id AS outbox_id,o.notification_id,o.attempts,n.*`,
    [maxNotifications]
  ));
  let published = 0;
  let failed = 0;
  for (const row of due.rows) {
    try {
      await transaction(async (client) => {
        await client.query("UPDATE platform_notifications SET status='preparing',updated_at=now() WHERE id=$1 AND status NOT IN ('cancelled','archived')", [row.notification_id]);
        const progress = await client.query("SELECT last_cursor,processed_count FROM platform_notification_publish_progress WHERE notification_id=$1", [row.notification_id]);
        let cursor = progress.rows[0]?.last_cursor || null;
        let total = Number(progress.rows[0]?.processed_count || 0);
        while (true) {
          const state = await client.query("SELECT status FROM platform_notifications WHERE id=$1", [row.notification_id]);
          if (state.rows[0]?.status === "cancelled") break;
          const batch = await materializeAudienceBatch(client, row, cursor, batchSize);
          if (!batch.scanned) break;
          cursor = batch.lastCursor;
          total += batch.count;
          await client.query(
            `INSERT INTO platform_notification_publish_progress(notification_id,last_cursor,processed_count)
             VALUES ($1,$2,$3)
             ON CONFLICT(notification_id) DO UPDATE SET last_cursor=$2,processed_count=$3,updated_at=now()`,
            [row.notification_id, cursor, total]
          );
          await client.query(
            `UPDATE platform_notifications
                SET status='publishing',created_recipients=$2,delivered_count=$2,updated_at=now()
              WHERE id=$1`,
            [row.notification_id, total]
          );
          if (batch.scanned < batchSize) break;
        }
        const state = await client.query("SELECT status,eligible_recipients FROM platform_notifications WHERE id=$1", [row.notification_id]);
        if (state.rows[0]?.status !== "cancelled") {
          const finalStatus = total < Number(state.rows[0]?.eligible_recipients || 0) ? "partially_published" : "published";
          await client.query(
            `UPDATE platform_notifications SET status=$2,published_at=COALESCE(published_at,now()),
                    created_recipients=$3,delivered_count=$3,
                    failed_recipients=GREATEST(eligible_recipients-$3,0),updated_at=now()
              WHERE id=$1`,
            [row.notification_id, finalStatus, total]
          );
        }
        await client.query("UPDATE platform_notification_outbox SET status='completed',processed_at=now() WHERE id=$1", [row.outbox_id]);
      });
      published++;
    } catch (error) {
      failed++;
      const retryDelaySeconds = Math.min(300, 2 ** Math.max(Number(row.attempts || 1) - 1) * 15);
      await query(
        `UPDATE platform_notification_outbox
            SET status='failed',failure_code=$2,
                available_at=now()+($3::text || ' seconds')::interval
          WHERE id=$1`,
        [row.outbox_id, String(error?.code || "worker_failed").slice(0, 100), retryDelaySeconds]
      );
      await query(
        `UPDATE platform_notifications SET status=CASE WHEN created_recipients>0 THEN 'partially_published' ELSE 'failed' END,updated_at=now() WHERE id=$1`,
        [row.notification_id]
      );
    }
  }
  return { processed: due.rowCount, published, failed };
}

const RECIPIENT_EVENTS = {
  seen: ["first_seen_at", "seen_count"],
  read: ["read_at", "read_count"],
  click: ["clicked_at", "clicked_count"],
  acknowledge: ["acknowledged_at", "acknowledged_count"],
  dismiss: ["dismissed_at", null]
};

export async function updatePlatformNotificationRecipient({ recipientId, userId, event }) {
  const mapping = RECIPIENT_EVENTS[event];
  if (!mapping) throw new Error("INVALID_NOTIFICATION_EVENT");
  const [column, counter] = mapping;
  return transaction(async (client) => {
    const changed = await client.query(
      `UPDATE platform_notification_recipients
          SET ${column}=now()
        WHERE id=$1 AND user_id=$2 AND ${column} IS NULL
        RETURNING notification_id`,
      [recipientId, userId]
    );
    if (!changed.rows[0]) {
      const owned = await client.query("SELECT id FROM platform_notification_recipients WHERE id=$1 AND user_id=$2", [recipientId, userId]);
      return owned.rows[0] ? { ok: true, changed: false } : null;
    }
    if (counter) {
      await client.query(`UPDATE platform_notifications SET ${counter}=${counter}+1 WHERE id=$1`, [changed.rows[0].notification_id]);
    }
    return { ok: true, changed: true };
  });
}
