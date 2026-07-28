import { query } from "../../../../src/server/db.js";
import { deliverCustomWebhook, retryDelaySeconds } from "../../../../src/server/custom-integrations.js";
import {
  commitUsage,
  PlanEntitlementError,
  releaseUsage,
  reserveUsage
} from "../../../../src/server/plan-entitlements.js";

function authorized(req) {
  const expected = process.env.CRON_SECRET;
  const supplied = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  return expected && supplied && expected === supplied;
}

export async function POST(req) {
  if (!authorized(req)) return Response.json({ ok: false }, { status: 401 });
  const claimed = await query(
    `UPDATE custom_integration_webhook_deliveries d
        SET status='processing',attempts=attempts+1,updated_at=now()
      WHERE d.id IN (
        SELECT id FROM custom_integration_webhook_deliveries
         WHERE status IN ('pending','processing') AND next_attempt_at <= now()
         ORDER BY next_attempt_at FOR UPDATE SKIP LOCKED LIMIT 20
      )
      RETURNING d.id,d.endpoint_id AS "endpointId",d.integration_id AS "integrationId",
                d.tenant_id AS "tenantId",d.payload,d.attempts,d.max_attempts AS "maxAttempts"`,
  );
  let delivered = 0;
  for (const item of claimed.rows) {
    const endpoint = await query(
      `SELECT url,signing_secret_encrypted AS "signingSecretEncrypted"
         FROM custom_integration_webhook_endpoints
        WHERE id=$1 AND tenant_id=$2 AND status IN ('enabled','error')`,
      [item.endpointId, item.tenantId]
    );
    if (!endpoint.rows[0]) {
      await query("UPDATE custom_integration_webhook_deliveries SET status='cancelled',updated_at=now() WHERE id=$1", [item.id]);
      continue;
    }
    try {
      await reserveUsage({
        tenantId: item.tenantId,
        featureKey: "webhook_deliveries_monthly",
        amount: 1
      });
    } catch (error) {
      if (!(error instanceof PlanEntitlementError)) throw error;
      await query(
        `UPDATE custom_integration_webhook_deliveries
            SET status='cancelled',error_code=$2,response_body_safe=$3,updated_at=now()
          WHERE id=$1`,
        [item.id, error.reason, error.message]
      );
      continue;
    }
    const result = await deliverCustomWebhook({ ...item, ...endpoint.rows[0] });
    if (result.ok) {
      delivered += 1;
      await Promise.all([
        commitUsage({ tenantId: item.tenantId, featureKey: "webhook_deliveries_monthly", amount: 1 }),
        query(
          `UPDATE custom_integration_webhook_deliveries
              SET status='delivered',response_status=$2,response_body_safe=$3,delivered_at=now(),updated_at=now()
            WHERE id=$1`,
          [item.id, result.status, result.preview]
        ),
        query(
          `UPDATE custom_integration_webhook_endpoints
              SET last_success_at=now(),last_tested_at=now(),failure_count=0,status='enabled',updated_at=now()
            WHERE id=$1`,
          [item.endpointId]
        ),
        query("UPDATE custom_integrations SET status='ACTIVE',last_success_at=now(),updated_at=now() WHERE id=$1", [item.integrationId])
      ]);
    } else {
      await releaseUsage({ tenantId: item.tenantId, featureKey: "webhook_deliveries_monthly", amount: 1 });
      const exhausted = item.attempts >= item.maxAttempts || !result.retryable;
      await Promise.all([
        query(
          `UPDATE custom_integration_webhook_deliveries
              SET status=$2,response_status=$3,response_body_safe=$4,error_code=$5,
                  next_attempt_at=now()+($6 || ' seconds')::interval,updated_at=now()
            WHERE id=$1`,
          [item.id, exhausted ? "failed" : "pending", result.status, result.preview, result.error || `http_${result.status}`,
            retryDelaySeconds(item.attempts)]
        ),
        query(
          `UPDATE custom_integration_webhook_endpoints
              SET last_failure_at=now(),failure_count=failure_count+1,
                  status=CASE WHEN failure_count+1 >= 7 THEN 'disabled' ELSE 'error' END,updated_at=now()
            WHERE id=$1`,
          [item.endpointId]
        )
      ]);
    }
  }
  return Response.json({ ok: true, claimed: claimed.rowCount, delivered });
}
