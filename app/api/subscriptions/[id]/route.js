import { transaction } from "../../../../src/server/db.js";
import { requireSession } from "../../../../src/server/session.js";
import { rescheduleSubscriptionReminders } from "../../../../src/server/subscription-operations.js";

const statuses = new Set(["pending_activation","active","expired","renewed","paused","cancelled","needs_review"]);
const channels = new Set(["whatsapp","email"]);

export async function PATCH(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const updated = await transaction(async (client) => {
    const current = await client.query("SELECT * FROM customer_subscriptions WHERE id=$1 AND tenant_id=$2 FOR UPDATE", [id, auth.session.tenantId]);
    if (!current.rows[0]) return null;
    const row = current.rows[0];
    const start = body.startDate || row.starts_at;
    const end = body.endDate || row.expires_at;
    if (new Date(end) < new Date(start)) throw new Error("invalid_dates");
    const preferred = channels.has(body.reminderChannel) ? body.reminderChannel : row.preferred_channel;
    const fallback = channels.has(body.fallbackChannel) && body.fallbackChannel !== preferred ? body.fallbackChannel : null;
    const result = await client.query(
      `UPDATE customer_subscriptions SET service_name=$2,starts_at=$3,expires_at=$4,status=$5,
        amount=$6,reminder_mode=$7,reminder_days=$8::jsonb,preferred_channel=$9,fallback_channel=$10,updated_at=now()
       WHERE id=$1 RETURNING id,order_number AS "orderNumber",reminder_mode AS "reminderMode",
        preferred_channel AS "reminderChannel",fallback_channel AS "fallbackChannel"`,
      [id, body.serviceName || row.service_name, start, end,
        statuses.has(body.status) ? body.status : row.status, Number(body.price ?? row.amount ?? 0),
        body.reminderMode === "manual" ? "manual" : "automatic",
        JSON.stringify([Math.max(0,Math.min(90,Number(body.reminderDaysBefore ?? row.reminder_days?.[0] ?? 7)))]), preferred, fallback]
    );
    if (row.legacy_subscription_id) await client.query(
      `UPDATE subscriptions SET service_name=$2,start_date=$3,end_date=$4,status=$5,price=$6,
        reminder_mode=$7,reminder_channel=$8,updated_at=now() WHERE id=$1`,
      [row.legacy_subscription_id, body.serviceName || row.service_name, start, end,
        ["pending_activation","needs_review"].includes(body.status) ? "paused" : body.status === "expiring_soon" ? "active" : statuses.has(body.status) ? body.status : row.status,
        Number(body.price ?? row.amount ?? 0), body.reminderMode === "manual" ? "manual" : "automatic", preferred]
    );
    return result.rows[0];
  });
  if (!updated) return Response.json({ ok:false }, { status:404 });
  await rescheduleSubscriptionReminders(auth.session.tenantId, id, updated.reminderMode === "automatic");
  return Response.json({ ok:true,item:updated });
}

export async function DELETE(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const changed = await transaction(async (client) => {
    const result = await client.query("UPDATE customer_subscriptions SET status='cancelled',updated_at=now() WHERE id=$1 AND tenant_id=$2 RETURNING id,legacy_subscription_id", [id, auth.session.tenantId]);
    if (!result.rows[0]) return false;
    await client.query("UPDATE subscription_reminders SET status='cancelled',failure_reason='subscription_cancelled',updated_at=now() WHERE subscription_id=$1 AND status IN ('scheduled','queued','processing','paused')", [id]);
    if (result.rows[0].legacy_subscription_id) await client.query("UPDATE subscriptions SET status='cancelled',updated_at=now() WHERE id=$1", [result.rows[0].legacy_subscription_id]);
    return true;
  });
  return changed ? Response.json({ok:true}) : Response.json({ok:false},{status:404});
}
