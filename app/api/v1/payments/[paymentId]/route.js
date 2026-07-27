import { authenticateCustomApi, customApiError } from "../../../../../src/server/custom-integrations.js";
import { query } from "../../../../../src/server/db.js";

export async function GET(req, { params }) {
  const auth = await authenticateCustomApi(req, "payments:read");
  if (!auth.ok) return customApiError(auth);
  const { paymentId } = await params;
  const result = await query(
    `SELECT id,external_id AS "externalId",amount,currency,status,occurred_at AS "occurredAt",metadata,created_at AS "createdAt"
       FROM custom_external_payments WHERE tenant_id=$1 AND integration_id=$2 AND id=$3 LIMIT 1`,
    [auth.tenantId, auth.integrationId, paymentId]
  );
  if (!result.rows[0]) return customApiError({ ...auth, code: "resource_not_found", status: 404 });
  return Response.json({ data: result.rows[0], request_id: auth.requestId });
}
