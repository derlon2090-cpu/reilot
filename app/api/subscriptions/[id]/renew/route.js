import crypto from "node:crypto";
import { addSubscriptionDuration } from "../../../../../src/lib/subscription-lifecycle.js";
import { transaction } from "../../../../../src/server/db.js";
import { requireSession } from "../../../../../src/server/session.js";
import { rescheduleSubscriptionReminders } from "../../../../../src/server/subscription-operations.js";

const durations = {
  month: [1, "month"],
  three_months: [3, "month"],
  six_months: [6, "month"],
  year: [1, "year"]
};

export async function POST(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    const result = await transaction(async (client) => {
      const existing = await client.query("SELECT * FROM customer_subscriptions WHERE id=$1 AND tenant_id=$2 FOR UPDATE", [id, auth.session.tenantId]);
      const row = existing.rows[0];
      if (!row) return null;
      const previous = new Date(row.expires_at);
      let newExpiry;
      let durationValue;
      let durationUnit;
      if (body.duration === "custom") {
        newExpiry = new Date(body.customDate);
        if (Number.isNaN(newExpiry.getTime()) || newExpiry <= previous) throw new Error("invalid_duration");
        durationValue = Math.ceil((newExpiry.getTime() - previous.getTime()) / 86400000);
        durationUnit = "day";
      } else {
        [durationValue, durationUnit] = durations[body.duration] || [];
        if (!durationValue) throw new Error("invalid_duration");
        const base = previous > new Date() ? previous : new Date();
        newExpiry = addSubscriptionDuration(base, durationValue, durationUnit);
      }
      const sourceItemId = `manual:${crypto.randomUUID()}`;
      await client.query(
        `INSERT INTO subscription_renewals
           (tenant_id,subscription_id,source,source_order_item_id,previous_expires_at,new_expires_at,duration_value,duration_unit)
         VALUES ($1,$2,'manual',$3,$4,$5,$6,$7)`,
        [auth.session.tenantId, id, sourceItemId, previous, newExpiry, durationValue, durationUnit]
      );
      const updated = await client.query(
        `UPDATE customer_subscriptions SET expires_at=$2,status='active',last_renewed_at=now(),notification_status='ready',updated_at=now()
          WHERE id=$1 RETURNING id,expires_at AS "endDate",status`, [id, newExpiry]
      );
      await client.query(
        "UPDATE subscription_reminders SET status='cancelled',failure_reason='subscription_was_renewed',updated_at=now() WHERE subscription_id=$1 AND status IN ('scheduled','queued','processing','paused')",
        [id]
      );
      await client.query(
        `INSERT INTO activity_logs (tenant_id,user_id,type,title,metadata)
         VALUES ($1,$2,'subscription.renewed','Subscription renewed',$3::jsonb)`,
        [auth.session.tenantId, auth.session.userId, JSON.stringify({ subscriptionId: id, previousExpiresAt: previous, newExpiresAt: newExpiry })]
      );
      return updated.rows[0];
    });
    if (!result) return Response.json({ ok: false }, { status: 404 });
    await rescheduleSubscriptionReminders(auth.session.tenantId, id, true);
    return Response.json({ ok: true, subscription: result });
  } catch {
    return Response.json({ ok: false, reason: "invalid_duration" }, { status: 400 });
  }
}
