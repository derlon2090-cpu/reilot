import { query } from "../../../../../src/server/db.js";
import { requireSession } from "../../../../../src/server/session.js";

export async function GET(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const result = await query(
    `SELECT nl.id, nl.channel, nl.status, nl.to_number AS "toNumber", nl.message_type AS "messageType",
            nl.error_message AS "errorMessage", nl.sent_at AS "sentAt", nl.created_at AS "createdAt"
       FROM notification_logs nl JOIN subscriptions s ON s.id = nl.subscription_id
      WHERE nl.subscription_id = $1 AND nl.tenant_id = $2 AND s.tenant_id = $2 ORDER BY nl.created_at DESC`,
    [id, auth.session.tenantId]
  );
  return Response.json({ ok: true, items: result.rows });
}
