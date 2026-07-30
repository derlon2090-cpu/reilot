import { requireSession } from "../../../../src/server/session.js";
import { query, transaction } from "../../../../src/server/db.js";
import {
  createApiKey,
  isCustomIntegrationConfigurationError,
  normalizeScopes
} from "../../../../src/server/custom-integrations.js";
import { requirePlanEntitlement, planEntitlementResponse } from "../../../../src/server/plan-entitlements.js";

export async function GET(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const result = await query(
    `SELECT i.id,i.name,i.description,i.environment,i.direction,i.status,i.scopes,
            i.last_success_at AS "lastApiRequestAt",i.last_error_at AS "lastErrorAt",
            i.created_at AS "createdAt",
            COALESCE((SELECT count(*) FROM custom_integration_api_keys k WHERE k.integration_id=i.id AND k.revoked_at IS NULL),0)::int AS "activeKeys",
            COALESCE((SELECT count(*) FROM custom_integration_webhook_endpoints w WHERE w.integration_id=i.id AND w.status='enabled'),0)::int AS "activeWebhooks",
            (SELECT k.key_prefix
               FROM custom_integration_api_keys k
              WHERE k.integration_id=i.id AND k.tenant_id=i.tenant_id AND k.revoked_at IS NULL
              ORDER BY k.created_at DESC LIMIT 1) AS "latestKeyPrefix",
            (SELECT k.last_used_at
               FROM custom_integration_api_keys k
              WHERE k.integration_id=i.id AND k.tenant_id=i.tenant_id AND k.revoked_at IS NULL
              ORDER BY k.created_at DESC LIMIT 1) AS "latestKeyUsedAt",
            COALESCE((
              SELECT jsonb_build_object(
                'id', w.id,
                'url', w.url,
                'status', w.status,
                'events', w.event_types,
                'lastTestedAt', w.last_tested_at,
                'lastSuccessAt', w.last_success_at,
                'lastFailureAt', w.last_failure_at,
                'failureCount', w.failure_count
              )
                FROM custom_integration_webhook_endpoints w
               WHERE w.integration_id=i.id AND w.tenant_id=i.tenant_id
               ORDER BY w.created_at DESC LIMIT 1
            ), '{}'::jsonb) AS webhook,
            COALESCE((SELECT count(*) FROM custom_integration_events e
                       WHERE e.integration_id=i.id AND e.tenant_id=i.tenant_id
                         AND e.created_at > now() - interval '24 hours'),0)::int AS "events24h",
            COALESCE((SELECT count(*) FROM custom_integration_webhook_deliveries d
                       WHERE d.integration_id=i.id AND d.tenant_id=i.tenant_id
                         AND d.status='delivered'
                         AND d.created_at > now() - interval '24 hours'),0)::int AS "delivered24h",
            COALESCE((SELECT count(*) FROM custom_integration_webhook_deliveries d
                       WHERE d.integration_id=i.id AND d.tenant_id=i.tenant_id
                         AND d.status IN ('pending','processing')),0)::int AS "pendingDeliveries",
            COALESCE((
              SELECT jsonb_agg(to_jsonb(recent_delivery))
                FROM (
                  SELECT d.id,
                         d.event_type AS "eventType",
                         d.status,
                         d.response_status AS "httpStatus",
                         d.attempts,
                         d.error_code AS "errorCode",
                         d.created_at AS "createdAt",
                         d.delivered_at AS "deliveredAt"
                    FROM custom_integration_webhook_deliveries d
                   WHERE d.integration_id=i.id AND d.tenant_id=i.tenant_id
                   ORDER BY d.created_at DESC
                   LIMIT 8
                ) recent_delivery
            ), '[]'::jsonb) AS "recentDeliveries"
       FROM custom_integrations i WHERE i.tenant_id=$1 ORDER BY i.created_at DESC`,
    [auth.session.tenantId]
  );
  const [entitlements, usage, billing, invoices] = await Promise.all([
    query(`WITH current_subscription AS (
             SELECT plan_id FROM platform_subscriptions
              WHERE tenant_id=$1 AND status IN ('active','trial','past_due','grace_period') AND current_period_end>now()
              ORDER BY created_at DESC LIMIT 1
           ), effective_plan AS (
             SELECT plan_id FROM current_subscription
             UNION ALL
             SELECT id AS plan_id FROM platform_plans
              WHERE slug='free' AND NOT EXISTS (SELECT 1 FROM current_subscription)
             LIMIT 1
           )
           SELECT e.feature_key AS "featureKey",e.enabled,e.limit_value AS "limitValue",e.limit_unit AS "limitUnit"
             FROM effective_plan s JOIN billing_plan_entitlements e ON e.plan_id=s.plan_id`, [auth.session.tenantId]),
    query(`SELECT feature_key AS "featureKey",used_value AS "usedValue",reserved_value AS "reservedValue",
                  limit_value AS "limitValue",period_start AS "periodStart",period_end AS "periodEnd"
             FROM billing_usage_counters WHERE tenant_id=$1 AND period_start<=now() AND period_end>now()`, [auth.session.tenantId]),
    query(`SELECT p.slug,p.name,p.monthly_price_sar AS "monthlyPriceSar",s.status,
                  s.current_period_start AS "periodStart",s.current_period_end AS "periodEnd",s.payment_provider AS provider
             FROM platform_subscriptions s JOIN platform_plans p ON p.id=s.plan_id
            WHERE s.tenant_id=$1 ORDER BY s.created_at DESC LIMIT 1`, [auth.session.tenantId]),
    query(`SELECT id,invoice_number AS number,status,amount,currency,issued_at AS "issuedAt",paid_at AS "paidAt"
             FROM billing_invoices WHERE tenant_id=$1 ORDER BY issued_at DESC LIMIT 10`, [auth.session.tenantId])
  ]);
  const items = await Promise.all(result.rows.map(async (integration) => {
    const [keys, webhooks] = await Promise.all([
      query(`SELECT id,name,key_prefix AS prefix,environment,status,scopes,last_used_at AS "lastUsedAt",
                    expires_at AS "expiresAt",revoked_at AS "revokedAt",request_count AS "requestCount",created_at AS "createdAt"
               FROM custom_integration_api_keys WHERE integration_id=$1 AND tenant_id=$2 ORDER BY created_at DESC`, [integration.id, auth.session.tenantId]),
      query(`SELECT id,url,description,event_types AS events,status,last_tested_at AS "lastTestedAt",
                    last_success_at AS "lastSuccessAt",last_failure_at AS "lastFailureAt",failure_count AS "failureCount",created_at AS "createdAt"
               FROM custom_integration_webhook_endpoints WHERE integration_id=$1 AND tenant_id=$2 ORDER BY created_at DESC`, [integration.id, auth.session.tenantId])
    ]);
    return { ...integration, keys: keys.rows, webhooks: webhooks.rows };
  }));
  return Response.json({
    ok: true,
    items,
    entitlements: Object.fromEntries(entitlements.rows.map((entry) => [entry.featureKey, entry])),
    usage: usage.rows,
    billing: { subscription: billing.rows[0] || null, invoices: invoices.rows, providerConfigured: Boolean(billing.rows[0]?.provider) }
  });
}

export async function POST(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  if (!["owner", "admin", "ADMIN"].includes(auth.session.role)) {
    return Response.json({ ok: false, code: "forbidden", message: "لا تملك صلاحية إنشاء هذا التكامل." }, { status: 403 });
  }

  try {
    await requirePlanEntitlement(auth.session.tenantId, "api_access");
    const body = await req.json().catch(() => ({}));
    const name = String(body.name || "").trim();
    const scopes = normalizeScopes(body.scopes);
    if (!name || !scopes.length) {
      return Response.json({ ok: false, code: "validation_error", message: "أدخل اسم التكامل واختر صلاحية واحدة على الأقل." }, { status: 400 });
    }

    const direction = ["inbound", "outbound", "bidirectional"].includes(body.direction) ? body.direction : "bidirectional";
    const key = createApiKey(body.environment);
    const item = await transaction(async (client) => {
      const integration = await client.query(
        `INSERT INTO custom_integrations
           (tenant_id,name,description,environment,direction,status,scopes,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)
         RETURNING id,name,environment,direction,status`,
        [auth.session.tenantId, name, body.description || null, body.environment === "test" ? "test" : "live",
          direction, direction === "inbound" ? "ACTIVE" : "PARTIALLY_CONFIGURED",
          JSON.stringify(scopes), auth.session.userId]
      );
      await client.query(
        `INSERT INTO custom_integration_api_keys
           (integration_id,tenant_id,name,public_key_id,key_prefix,key_digest,environment,status,scopes,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'ACTIVE',$8::jsonb,$9)`,
        [integration.rows[0].id, auth.session.tenantId, body.keyName || "المفتاح الرئيسي",
          key.publicKeyId, key.prefix, key.digest, key.environment, JSON.stringify(scopes), auth.session.userId]
      );
      await client.query(
        `INSERT INTO activity_logs (tenant_id,user_id,type,title,metadata)
         VALUES ($1,$2,'custom_integration.created','Custom integration created',$3::jsonb)`,
        [auth.session.tenantId, auth.session.userId, JSON.stringify({ integrationId: integration.rows[0].id, keyPrefix: key.prefix })]
      );
      return integration.rows[0];
    });
    return Response.json({ ok: true, item, apiKey: key.raw, warning: "انسخ المفتاح الآن. لن يظهر كاملًا مرة أخرى." }, { status: 201 });
  } catch (error) {
    const entitlementResponse = planEntitlementResponse(error);
    if (entitlementResponse) return entitlementResponse;
    if (isCustomIntegrationConfigurationError(error)) {
      return Response.json({
        ok: false,
        code: "custom_integration_security_not_configured",
        message: "تعذر تهيئة مفاتيح أمان التكامل. تحقق من إعداد أسرار التشفير في بيئة الخادم."
      }, { status: 503 });
    }
    if (["42P01", "42703"].includes(error?.code)) {
      return Response.json({
        ok: false,
        code: "custom_integration_schema_missing",
        message: "قاعدة البيانات غير مهيأة للتكامل المخصص. شغّل ترحيلات قاعدة البيانات ثم أعد المحاولة."
      }, { status: 503 });
    }
    console.error("custom_integration_create_failed", { code: error?.code || "unknown", name: error?.name || "Error" });
    return Response.json({
      ok: false,
      code: "custom_integration_create_failed",
      message: "تعذر إنشاء التكامل حاليًا. تحقق من اتصال قاعدة البيانات ثم أعد المحاولة."
    }, { status: 500 });
  }
}
