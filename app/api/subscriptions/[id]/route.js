import { transaction } from "../../../../src/server/db.js";
import { requireSession } from "../../../../src/server/session.js";

const allowedStatuses = new Set(["active", "expiring_soon", "expired", "renewed", "paused", "cancelled"]);
const allowedChannels = new Set(["whatsapp", "email"]);
const allowedReminderModes = new Set(["manual", "automatic"]);

export async function PATCH(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const status = allowedStatuses.has(body.status) ? body.status : "active";
  const reminderChannel = allowedChannels.has(body.reminderChannel) ? body.reminderChannel : "whatsapp";
  const reminderMode = allowedReminderModes.has(body.reminderMode) ? body.reminderMode : "manual";
  const parsedDays = Number(body.reminderDaysBefore);
  const reminderDaysBefore = Number.isInteger(parsedDays) && parsedDays >= 0 && parsedDays <= 90 ? parsedDays : 7;
  const item = await transaction(async (client) => {
    const updated = await client.query(
      `UPDATE subscriptions SET service_name = $1, plan_name = $2, start_date = $3, end_date = $4,
              renewal_url = $5, status = $6, price = $7, notes = $8,
              reminder_channel = $9, reminder_mode = $10, reminder_days_before = $11, updated_at = now()
        WHERE id = $12 AND tenant_id = $13
        RETURNING id, order_number AS "orderNumber",
                  reminder_channel AS "reminderChannel", reminder_mode AS "reminderMode",
                  reminder_days_before AS "reminderDaysBefore"`,
      [body.serviceName, body.planName, body.startDate, body.endDate, body.renewalUrl || null, status, Number(body.price || 0), body.notes || null,
        reminderChannel, reminderMode, reminderDaysBefore, id, auth.session.tenantId]
    );
    if (!updated.rows[0]) return null;
    await client.query(
      `INSERT INTO activity_logs (tenant_id, user_id, type, title, metadata)
       VALUES ($1, $2, 'subscription.updated', 'Subscription updated', $3::jsonb)`,
      [auth.session.tenantId, auth.session.userId, JSON.stringify({ subscriptionId: id })]
    );
    return updated.rows[0];
  });
  return item ? Response.json({ ok: true, item }) : Response.json({ ok: false }, { status: 404 });
}

export async function DELETE(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const deleted = await transaction(async (client) => {
    const result = await client.query(
      `DELETE FROM subscriptions WHERE id = $1 AND tenant_id = $2 RETURNING id, order_number AS "orderNumber"`,
      [id, auth.session.tenantId]
    );
    if (!result.rows[0]) return null;
    await client.query(
      `INSERT INTO activity_logs (tenant_id, user_id, type, title, metadata)
       VALUES ($1, $2, 'subscription.deleted', 'Subscription deleted', $3::jsonb)`,
      [auth.session.tenantId, auth.session.userId, JSON.stringify({ subscriptionId: id, orderNumber: result.rows[0].orderNumber })]
    );
    return result.rows[0];
  });
  return deleted ? Response.json({ ok: true }) : Response.json({ ok: false }, { status: 404 });
}
