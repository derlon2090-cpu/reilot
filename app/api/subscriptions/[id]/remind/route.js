import { query } from "../../../../../src/server/db.js";
import { requireSession } from "../../../../../src/server/session.js";
import { createInAppNotification } from "../../../../../src/server/in-app-notifications.js";
import { getSubscriptionReminderPreview, queueSubscriptionReminder } from "../../../../../src/server/renewal-reminders.js";

export async function GET(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const preview = await getSubscriptionReminderPreview(auth.session.tenantId, id);
  return Response.json(preview, { status: preview.ok ? 200 : preview.reason === "subscription_not_found" ? 404 : 409 });
}

export async function POST(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (body.confirmed !== true) return Response.json({ ok: false, reason: "confirmation_required" }, { status: 400 });
  const queued = await queueSubscriptionReminder({ tenantId: auth.session.tenantId, subscriptionId: id, sourceMode: "manual" });
  if (!queued.ok) return Response.json(queued, { status: queued.reason === "subscription_not_found" ? 404 : 409 });
  await query(
    `INSERT INTO activity_logs (tenant_id,user_id,type,title,metadata)
     VALUES ($1,$2,'subscription.reminder_queued','Renewal reminder queued',$3::jsonb)`,
    [auth.session.tenantId, auth.session.userId, JSON.stringify({ subscriptionId: id, queueId: queued.queueId, scheduledFor: queued.scheduledFor })]
  );
  await createInAppNotification({
    tenantId: auth.session.tenantId,
    userId: auth.session.userId,
    type: "message_scheduled",
    title: "تمت جدولة تذكير التجديد",
    message: "أُضيف التذكير إلى قائمة الإرسال، ولن يُخصم الرصيد إلا بعد نجاح المزود.",
    entityType: "subscription",
    entityId: id,
    actionUrl: `/dashboard/subscriptions?subscriptionId=${id}`,
    metadata: { queueId: queued.queueId, scheduledFor: queued.scheduledFor },
    dedupeKey: `manual-reminder:${queued.queueId}`
  }).catch(() => null);
  return Response.json({ ok: true, queueId: queued.queueId, scheduledFor: queued.scheduledFor }, { status: 202 });
}
