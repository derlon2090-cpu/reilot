import { authenticateCustomApi, customApiError, publishCustomEvent, withIdempotency } from "../../../../src/server/custom-integrations.js";
import { transaction } from "../../../../src/server/db.js";

export async function POST(req) {
  const auth = await authenticateCustomApi(req, "payments:write");
  if (!auth.ok) return customApiError(auth);
  const body = await req.json().catch(() => ({}));
  const status = String(body.status || "").toUpperCase();
  const amount = Number(body.amount);
  if (!body.external_id || !["PENDING","SUCCEEDED","FAILED","REFUNDED"].includes(status) || !Number.isFinite(amount) || amount < 0) {
    return customApiError({ ...auth, code: "validation_error", status: 400 });
  }
  return withIdempotency({
    req, auth, routeKey: "POST:/api/v1/payments", body,
    execute: async () => {
      const payment = await transaction(async (client) => {
        const inserted = await client.query(
          `INSERT INTO custom_external_payments
             (tenant_id,integration_id,external_id,customer_id,subscription_id,amount,currency,status,occurred_at,metadata)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
           ON CONFLICT (tenant_id,integration_id,external_id)
           DO UPDATE SET status=EXCLUDED.status,amount=EXCLUDED.amount,currency=EXCLUDED.currency,
                         occurred_at=EXCLUDED.occurred_at,metadata=EXCLUDED.metadata,updated_at=now()
           RETURNING id,external_id AS "externalId",amount,currency,status,occurred_at AS "occurredAt"`,
          [auth.tenantId, auth.integrationId, body.external_id, body.customer_id || null, body.subscription_id || null,
            amount, String(body.currency || "SAR").toUpperCase(), status, body.occurred_at || new Date(), JSON.stringify(body.metadata || {})]
        );
        const item = inserted.rows[0];
        if (status === "SUCCEEDED" || status === "FAILED") {
          await publishCustomEvent(client, {
            tenantId: auth.tenantId, integrationId: auth.integrationId,
            type: status === "SUCCEEDED" ? "payment.succeeded" : "payment.failed",
            resourceType: "payment", resourceId: item.id,
            object: { id: item.id, external_id: item.externalId, amount: item.amount, currency: item.currency, status }
          });
        }
        return item;
      });
      return { status: 202, body: { data: payment, request_id: auth.requestId } };
    }
  });
}
