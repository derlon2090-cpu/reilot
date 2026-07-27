import { authenticateCustomApi, customApiError } from "../../../../../src/server/custom-integrations.js";
import { query } from "../../../../../src/server/db.js";

export async function GET(req, { params }) {
  const auth = await authenticateCustomApi(req, "messages:read");
  if (!auth.ok) return customApiError(auth);
  const { messageId } = await params;
  const result = await query(
    `SELECT id,channel_type AS channel,status,provider_message_id AS "providerMessageId",
            scheduled_for AS "scheduledFor",sent_at AS "sentAt",failed_at AS "failedAt",
            failure_code AS "failureCode",created_at AS "createdAt",updated_at AS "updatedAt"
       FROM message_queue WHERE tenant_id=$1 AND id=$2 AND message_type='custom_api' LIMIT 1`,
    [auth.tenantId, messageId]
  );
  if (!result.rows[0]) return customApiError({ ...auth, code: "resource_not_found", status: 404 });
  return Response.json({ data: result.rows[0], request_id: auth.requestId });
}
