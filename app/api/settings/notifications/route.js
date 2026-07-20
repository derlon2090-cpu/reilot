import { query } from "../../../../src/server/db.js";
import { requireSession } from "../../../../src/server/session.js";
import { notificationsSchema, validationResponse } from "../../../../src/server/settings-profile.js";

const selectPreferences = `SELECT renewal_billing_notifications AS "renewalBillingNotifications",
  security_notifications AS "securityNotifications", product_updates AS "productUpdates",
  message_failure_notifications AS "messageFailureNotifications"
  FROM user_notification_preferences WHERE user_id = $1`;

export async function GET(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  const result = await query(selectPreferences, [auth.session.userId]);
  return Response.json({ ok: true, notifications: result.rows[0] || {
    renewalBillingNotifications: true,
    securityNotifications: true,
    productUpdates: true,
    messageFailureNotifications: true
  } });
}

export async function PATCH(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  const parsed = notificationsSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationResponse(parsed);
  await query(
    `INSERT INTO user_notification_preferences
       (user_id, renewal_billing_notifications, security_notifications, product_updates, message_failure_notifications)
     VALUES ($1, $2, true, $3, $4)
     ON CONFLICT (user_id) DO UPDATE SET
       renewal_billing_notifications = EXCLUDED.renewal_billing_notifications,
       security_notifications = true,
       product_updates = EXCLUDED.product_updates,
       message_failure_notifications = EXCLUDED.message_failure_notifications,
       updated_at = now()`,
    [auth.session.userId, parsed.data.renewalBillingNotifications, parsed.data.productUpdates, parsed.data.messageFailureNotifications]
  );
  await query(
    `INSERT INTO activity_logs (tenant_id, user_id, type, title)
     VALUES ($1, $2, 'notifications.updated', 'Notification preferences updated')`,
    [auth.session.tenantId, auth.session.userId]
  );
  const result = await query(selectPreferences, [auth.session.userId]);
  return Response.json({ ok: true, notifications: result.rows[0] });
}
