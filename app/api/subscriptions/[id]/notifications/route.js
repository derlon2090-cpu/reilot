import { query } from "../../../../../src/server/db.js";
import { requireSession } from "../../../../../src/server/session.js";

export async function GET(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const result = await query(
    `SELECT mq.id, mq.channel_type AS channel, mq.status, mq.destination AS "toNumber",
            mq.message_type AS "messageType", mq.last_error AS "errorMessage",
            mq.sent_at AS "sentAt", mq.created_at AS "createdAt", mq.provider_message_id AS "providerMessageId",
            mq.billing_status AS "billingStatus"
       FROM message_queue mq JOIN customer_subscriptions cs ON cs.id=mq.customer_subscription_id
      WHERE mq.customer_subscription_id=$1 AND mq.tenant_id=$2 AND cs.tenant_id=$2
      ORDER BY mq.created_at DESC`,
    [id, auth.session.tenantId]
  );
  return Response.json({ ok: true, items: result.rows });
}
