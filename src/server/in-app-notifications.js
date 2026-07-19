import { query } from "./db.js";

export async function createInAppNotification({
  tenantId,
  userId = null,
  type,
  title,
  message = null,
  entityType = null,
  entityId = null,
  priority = "normal",
  actionUrl = null,
  metadata = {},
  dedupeKey = null
}) {
  if (!tenantId || !type || !title) {
    throw new Error("Missing required notification fields");
  }

  const result = await query(
    `INSERT INTO in_app_notifications (
       tenant_id, user_id, type, title, message, entity_type, entity_id,
       priority, action_url, metadata, dedupe_key
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)
     ON CONFLICT (tenant_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
     RETURNING id, created_at AS "createdAt"`,
    [
      tenantId,
      userId,
      type,
      title,
      message,
      entityType,
      entityId,
      priority,
      actionUrl,
      JSON.stringify(metadata || {}),
      dedupeKey
    ]
  );

  return result.rows[0] || null;
}
