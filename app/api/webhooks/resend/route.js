import { createResendClient } from "../../../../src/lib/email/resend.js";
import { transaction } from "../../../../src/server/db.js";

const STATUS_MAP = Object.freeze({
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.bounced": "failed",
  "email.failed": "failed",
  "email.suppressed": "failed",
  "email.complained": "failed"
});

export async function POST(request) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return Response.json({ ok: false, error: "Webhook is not configured" }, { status: 503 });
  }
  const rawBody = await request.text();
  let event;
  try {
    event = createResendClient().webhooks.verify({
      payload: rawBody,
      headers: {
        id: request.headers.get("svix-id"),
        timestamp: request.headers.get("svix-timestamp"),
        signature: request.headers.get("svix-signature")
      },
      webhookSecret
    });
  } catch {
    return Response.json({ ok: false, error: "Invalid webhook signature" }, { status: 400 });
  }

  const providerEventId = request.headers.get("svix-id");
  const providerMessageId = event?.data?.email_id || event?.data?.id || null;
  const eventType = String(event?.type || "unknown");
  if (!providerEventId) {
    return Response.json({ ok: false, error: "Webhook event id is missing" }, { status: 400 });
  }

  await transaction(async (client) => {
    const inserted = await client.query(
      `INSERT INTO admin_message_provider_events
         (provider,provider_event_id,provider_message_id,event_type,payload)
       VALUES ('resend',$1,$2,$3,$4::jsonb)
       ON CONFLICT (provider,provider_event_id) DO NOTHING RETURNING id`,
      [providerEventId, providerMessageId, eventType, JSON.stringify(event)]
    );
    if (!inserted.rows[0]) return;
    const status = STATUS_MAP[eventType];
    if (status && providerMessageId) {
      await client.query(
        `UPDATE admin_outbound_messages SET
                status=CASE
                  WHEN status IN ('delivered','read') AND $2='sent' THEN status
                  ELSE $2
                END,
                sent_at=CASE WHEN $2='sent' THEN COALESCE(sent_at,now()) ELSE sent_at END,
                delivered_at=CASE WHEN $2='delivered' THEN COALESCE(delivered_at,now()) ELSE delivered_at END,
                failed_at=CASE WHEN $2='failed' THEN COALESCE(failed_at,now()) ELSE failed_at END,
                failure_code=CASE WHEN $2='failed' THEN $3 ELSE NULL END
          WHERE provider='resend' AND provider_message_id=$1`,
        [providerMessageId, status, eventType]
      );
      await client.query(
        `UPDATE account_provisioning_jobs SET credentials_email_status=$2,
                credentials_email_sent_at=CASE WHEN $2 IN ('sent','delivered') THEN COALESCE(credentials_email_sent_at,now()) ELSE credentials_email_sent_at END,
                failure_code=CASE WHEN $2='failed' THEN $3 ELSE NULL END,updated_at=now()
          WHERE credentials_email_id=$1`,
        [providerMessageId, status, eventType]
      );
    }
    await client.query(
      "UPDATE admin_message_provider_events SET processed_at=now() WHERE id=$1",
      [inserted.rows[0].id]
    );
  });
  return Response.json({ ok: true });
}
