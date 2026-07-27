import { authenticateCustomApi, customApiError, CUSTOM_EVENTS, withIdempotency } from "../../../../src/server/custom-integrations.js";
import { transaction } from "../../../../src/server/db.js";

export async function POST(req) {
  const auth = await authenticateCustomApi(req, "events:write");
  if (!auth.ok) return customApiError(auth);
  const body = await req.json().catch(() => ({}));
  const type = String(body.type || "");
  if (!CUSTOM_EVENTS.has(type)) return customApiError({ ...auth, code: "validation_error", status: 400 }, "نوع الحدث غير مدعوم.");
  return withIdempotency({
    req, auth, routeKey: "POST:/api/v1/events", body,
    execute: async () => {
      const item = await transaction(async (client) => {
        const inserted = await client.query(
          `INSERT INTO custom_integration_events
             (integration_id,tenant_id,direction,event_type,external_event_id,payload,status,processed_at)
           VALUES ($1,$2,'inbound',$3,$4,$5::jsonb,'processed',now())
           RETURNING id,created_at AS "createdAt"`,
          [auth.integrationId, auth.tenantId, type, body.external_id || null, JSON.stringify(body)]
        );
        return inserted.rows[0];
      });
      return { status: 202, body: { data: { id: item.id, type, status: "accepted", created_at: item.createdAt }, request_id: auth.requestId } };
    }
  });
}
