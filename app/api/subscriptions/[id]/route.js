import { transaction } from "../../../../src/server/db.js";
import { validateSubscriptionDeliveryContact } from "../../../../src/lib/subscription-lifecycle.js";
import { requireSession } from "../../../../src/server/session.js";
import { rescheduleSubscriptionReminders } from "../../../../src/server/subscription-operations.js";
import { assertPlanFeature, planEntitlementResponse } from "../../../../src/server/plan-entitlements.js";

const statuses = new Set(["pending_activation","active","expired","renewed","paused","cancelled","needs_review"]);
const channels = new Set(["whatsapp","email"]);

export async function PATCH(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (body.reminderMode === "automatic") {
    try {
      await assertPlanFeature(auth.session.tenantId, "automationEnabled");
    } catch (error) {
      const response = planEntitlementResponse(error);
      if (response) return response;
      throw error;
    }
  }
  const updated = await transaction(async (client) => {
    const current = await client.query(
      `SELECT cs.*,sc.email AS contact_email,sc.phone_e164 AS contact_phone,
              sc.legacy_customer_id
         FROM customer_subscriptions cs
         JOIN subscription_customers sc ON sc.id=cs.customer_id AND sc.tenant_id=cs.tenant_id
        WHERE cs.id=$1 AND cs.tenant_id=$2 FOR UPDATE OF cs,sc`,
      [id, auth.session.tenantId]
    );
    if (!current.rows[0]) return null;
    const row = current.rows[0];
    const start = body.startDate || row.starts_at;
    const end = body.endDate || row.expires_at;
    if (new Date(end) < new Date(start)) throw new Error("invalid_dates");
    const preferred = channels.has(body.reminderChannel) ? body.reminderChannel : row.preferred_channel;
    const contact = validateSubscriptionDeliveryContact({
      channel: preferred,
      whatsappNumber: Object.prototype.hasOwnProperty.call(body, "whatsappNumber") ? body.whatsappNumber : row.contact_phone,
      email: Object.prototype.hasOwnProperty.call(body, "email") ? body.email : row.contact_email
    });
    if (!contact.ok) return { validationError: contact };
    const fallback = channels.has(body.fallbackChannel) && body.fallbackChannel !== preferred ? body.fallbackChannel : null;
    const reminderMode = body.reminderMode === "manual" || body.reminderMode === "automatic"
      ? body.reminderMode
      : row.reminder_mode;
    const result = await client.query(
      `UPDATE customer_subscriptions SET service_name=$2,starts_at=$3,expires_at=$4,status=$5,
        amount=$6,reminder_mode=$7,reminder_days=$8::jsonb,preferred_channel=$9,fallback_channel=$10,updated_at=now()
       WHERE id=$1 RETURNING id,order_number AS "orderNumber",reminder_mode AS "reminderMode",
        preferred_channel AS "reminderChannel",fallback_channel AS "fallbackChannel"`,
      [id, body.serviceName || row.service_name, start, end,
        statuses.has(body.status) ? body.status : row.status, Number(body.price ?? row.amount ?? 0),
        reminderMode,
        JSON.stringify([Math.max(0,Math.min(90,Number(body.reminderDaysBefore ?? row.reminder_days?.[0] ?? 7)))]), preferred, fallback]
    );
    if (row.legacy_subscription_id) await client.query(
      `UPDATE subscriptions SET service_name=$2,start_date=$3,end_date=$4,status=$5,price=$6,
        reminder_mode=$7,reminder_channel=$8,updated_at=now() WHERE id=$1`,
      [row.legacy_subscription_id, body.serviceName || row.service_name, start, end,
        ["pending_activation","needs_review"].includes(body.status) ? "paused" : body.status === "expiring_soon" ? "active" : statuses.has(body.status) ? body.status : row.status,
        Number(body.price ?? row.amount ?? 0), reminderMode, preferred]
    );
    await client.query(
      `UPDATE subscription_customers SET
         phone_e164=COALESCE($2,phone_e164),email=COALESCE($3,email),
          email_normalized=COALESCE(lower($3::text),email_normalized),
         whatsapp_eligible=COALESCE($2,phone_e164) IS NOT NULL,
         email_eligible=COALESCE($3,email) IS NOT NULL,updated_at=now()
       WHERE id=$1 AND tenant_id=$4`,
      [row.customer_id, contact.phone, contact.email, auth.session.tenantId]
    );
    if (row.legacy_customer_id) {
      await client.query(
        `UPDATE customers SET email=COALESCE($2,email),phone=COALESCE($3,phone),
            whatsapp_number=COALESCE($3,whatsapp_number),updated_at=now()
          WHERE id=$1 AND tenant_id=$4`,
        [row.legacy_customer_id, contact.email, contact.phone, auth.session.tenantId]
      );
    }
    return result.rows[0];
  });
  if (updated?.validationError) {
    return Response.json({
      ok: false,
      reason: updated.validationError.reason,
      message: updated.validationError.message
    }, { status: 400 });
  }
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
