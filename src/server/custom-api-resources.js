import { query, transaction } from "./db.js";
import { isValidEmail, normalizeEmail } from "./security.js";
import { normalizeEvolutionPhone } from "../lib/evolution.js";
import { publishCustomEvent } from "./custom-integrations.js";

function customerShape(row) {
  return {
    id: row.id, external_id: row.externalId, name: row.name, phone: row.phone,
    email: row.email, status: row.status, metadata: row.metadata || {},
    created_at: row.createdAt, updated_at: row.updatedAt
  };
}

export async function listApiCustomers(auth, { limit = 25, cursor = "" } = {}) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 25));
  const result = await query(
    `SELECT id, external_id AS "externalId", name, phone, email, status, metadata,
            created_at AS "createdAt", updated_at AS "updatedAt"
       FROM customers
      WHERE tenant_id = $1 AND ($2::uuid IS NULL OR id < $2::uuid)
      ORDER BY id DESC LIMIT $3`,
    [auth.tenantId, /^[0-9a-f-]{36}$/i.test(cursor) ? cursor : null, safeLimit + 1]
  );
  const hasMore = result.rows.length > safeLimit;
  const rows = result.rows.slice(0, safeLimit);
  return { data: rows.map(customerShape), pagination: { next_cursor: hasMore ? rows.at(-1)?.id : null, has_more: hasMore }, request_id: auth.requestId };
}

export async function createApiCustomer(auth, body) {
  const name = String(body.name || "").trim();
  const email = body.email ? normalizeEmail(body.email) : null;
  if (!name || email && !isValidEmail(email)) return { status: 400, error: "validation_error" };
  let phone = null;
  if (body.phone) {
    const normalized = normalizeEvolutionPhone(body.phone);
    if (!normalized.ok) return { status: 400, error: "validation_error" };
    phone = normalized.phoneNumber;
  }
  const item = await transaction(async (client) => {
    const inserted = await client.query(
      `INSERT INTO customers (tenant_id, external_id, name, email, phone, whatsapp_number, metadata)
       VALUES ($1,$2,$3,$4,$5,$5,$6::jsonb)
       ON CONFLICT (tenant_id, external_id) WHERE external_id IS NOT NULL
       DO UPDATE SET name=EXCLUDED.name,email=EXCLUDED.email,phone=EXCLUDED.phone,
                     whatsapp_number=EXCLUDED.whatsapp_number,metadata=EXCLUDED.metadata,updated_at=now()
       RETURNING id, external_id AS "externalId", name, phone, email, status, metadata,
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [auth.tenantId, body.external_id || null, name, email, phone, JSON.stringify(body.metadata || {})]
    );
    await publishCustomEvent(client, {
      tenantId: auth.tenantId, integrationId: auth.integrationId, type: "customer.created",
      resourceType: "customer", resourceId: inserted.rows[0].id, object: customerShape(inserted.rows[0])
    });
    return customerShape(inserted.rows[0]);
  });
  return { status: 201, body: { data: item, request_id: auth.requestId } };
}

export async function findApiCustomer(auth, id) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id || ""))) return null;
  const result = await query(
    `SELECT id, external_id AS "externalId", name, phone, email, status, metadata,
            created_at AS "createdAt", updated_at AS "updatedAt"
       FROM customers WHERE tenant_id=$1 AND id=$2 LIMIT 1`,
    [auth.tenantId, id]
  );
  return result.rows[0] ? customerShape(result.rows[0]) : null;
}

export async function updateApiCustomer(auth, id, body) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id || ""))) return { status: 404, error: "resource_not_found" };
  const current = await findApiCustomer(auth, id);
  if (!current) return { status: 404, error: "resource_not_found" };
  const name = body.name === undefined ? current.name : String(body.name || "").trim();
  const email = body.email === undefined
    ? current.email
    : body.email
      ? normalizeEmail(body.email)
      : null;
  if (!name || email && !isValidEmail(email)) return { status: 400, error: "validation_error" };
  let phone = current.phone;
  if (body.phone !== undefined) {
    phone = null;
    if (body.phone) {
      const normalized = normalizeEvolutionPhone(body.phone);
      if (!normalized.ok) return { status: 400, error: "validation_error" };
      phone = normalized.phoneNumber;
    }
  }
  const status = body.status === undefined ? current.status : String(body.status);
  if (!["active", "inactive", "blocked"].includes(status)) return { status: 400, error: "validation_error" };
  const item = await transaction(async (client) => {
    const updated = await client.query(
      `UPDATE customers
          SET name=$3,email=$4,phone=$5,whatsapp_number=$5,status=$6,
              metadata=$7::jsonb,updated_at=now()
        WHERE tenant_id=$1 AND id=$2
        RETURNING id,external_id AS "externalId",name,phone,email,status,metadata,
                  created_at AS "createdAt",updated_at AS "updatedAt"`,
      [auth.tenantId, id, name, email, phone, status, JSON.stringify(body.metadata === undefined ? current.metadata : body.metadata || {})]
    );
    const shaped = customerShape(updated.rows[0]);
    await publishCustomEvent(client, {
      tenantId: auth.tenantId,
      integrationId: auth.integrationId,
      type: "customer.updated",
      resourceType: "customer",
      resourceId: shaped.id,
      object: shaped
    });
    return shaped;
  });
  return { status: 200, body: { data: item, request_id: auth.requestId } };
}

function subscriptionShape(row) {
  return {
    id: row.id, external_id: row.externalId, customer_id: row.customerId,
    order_number: row.orderNumber, service_name: row.serviceName, plan_name: row.planName,
    starts_at: row.startDate, expires_at: row.endDate, status: row.status,
    renewal_policy: row.autoRenew ? "AUTOMATIC" : "MANUAL", metadata: row.metadata || {},
    created_at: row.createdAt, updated_at: row.updatedAt
  };
}

export async function listApiSubscriptions(auth, { limit = 25, cursor = "" } = {}) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 25));
  const result = await query(
    `SELECT id,external_id AS "externalId",customer_id AS "customerId",order_number AS "orderNumber",
            service_name AS "serviceName",plan_name AS "planName",start_date AS "startDate",
            end_date AS "endDate",status,auto_renew AS "autoRenew",metadata,
            created_at AS "createdAt",updated_at AS "updatedAt"
       FROM subscriptions WHERE tenant_id=$1 AND ($2::uuid IS NULL OR id < $2::uuid)
      ORDER BY id DESC LIMIT $3`,
    [auth.tenantId, /^[0-9a-f-]{36}$/i.test(cursor) ? cursor : null, safeLimit + 1]
  );
  const hasMore = result.rows.length > safeLimit;
  const rows = result.rows.slice(0, safeLimit);
  return { data: rows.map(subscriptionShape), pagination: { next_cursor: hasMore ? rows.at(-1)?.id : null, has_more: hasMore }, request_id: auth.requestId };
}

export async function createApiSubscription(auth, body) {
  const customer = await query(
    `SELECT id FROM customers WHERE tenant_id=$1 AND (id::text=$2 OR external_id=$2) LIMIT 1`,
    [auth.tenantId, String(body.customer_id || body.customer_external_id || "")]
  );
  if (!customer.rows[0]) return { status: 404, error: "resource_not_found" };
  const startsAt = new Date(body.starts_at);
  const expiresAt = new Date(body.expires_at);
  if (!body.service_name || Number.isNaN(startsAt.getTime()) || Number.isNaN(expiresAt.getTime()) || expiresAt <= startsAt) {
    return { status: 400, error: "validation_error" };
  }
  const item = await transaction(async (client) => {
    const inserted = await client.query(
      `INSERT INTO subscriptions
         (tenant_id,external_id,customer_id,order_number,service_name,plan_name,start_date,end_date,status,auto_renew,metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active',$9,$10::jsonb)
       ON CONFLICT (tenant_id,external_id) WHERE external_id IS NOT NULL
       DO UPDATE SET service_name=EXCLUDED.service_name,plan_name=EXCLUDED.plan_name,
                     start_date=EXCLUDED.start_date,end_date=EXCLUDED.end_date,metadata=EXCLUDED.metadata,updated_at=now()
       RETURNING id,external_id AS "externalId",customer_id AS "customerId",order_number AS "orderNumber",
                 service_name AS "serviceName",plan_name AS "planName",start_date AS "startDate",
                 end_date AS "endDate",status,auto_renew AS "autoRenew",metadata,
                 created_at AS "createdAt",updated_at AS "updatedAt"`,
      [auth.tenantId, body.external_id || null, customer.rows[0].id,
        body.order_number || `API-${Date.now()}`, body.service_name, body.plan_name || body.service_name,
        startsAt.toISOString().slice(0, 10), expiresAt.toISOString().slice(0, 10),
        body.renewal_policy === "AUTOMATIC", JSON.stringify(body.metadata || {})]
    );
    const shaped = subscriptionShape(inserted.rows[0]);
    await publishCustomEvent(client, {
      tenantId: auth.tenantId, integrationId: auth.integrationId, type: "subscription.created",
      resourceType: "subscription", resourceId: shaped.id, object: shaped
    });
    return shaped;
  });
  return { status: 201, body: { data: item, request_id: auth.requestId } };
}

export async function findApiSubscription(auth, id) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id || ""))) return null;
  const result = await query(
    `SELECT id,external_id AS "externalId",customer_id AS "customerId",order_number AS "orderNumber",
            service_name AS "serviceName",plan_name AS "planName",start_date AS "startDate",
            end_date AS "endDate",status,auto_renew AS "autoRenew",metadata,
            created_at AS "createdAt",updated_at AS "updatedAt"
       FROM subscriptions
      WHERE tenant_id=$1 AND id=$2 LIMIT 1`,
    [auth.tenantId, id]
  );
  return result.rows[0] ? subscriptionShape(result.rows[0]) : null;
}

function validSubscriptionStatus(value) {
  return ["active", "expiring_soon", "expired", "renewed", "paused", "cancelled"].includes(String(value));
}

export async function updateApiSubscription(auth, id, body) {
  const current = await findApiSubscription(auth, id);
  if (!current) return { status: 404, error: "resource_not_found" };
  const startsAt = body.starts_at === undefined ? new Date(current.starts_at) : new Date(body.starts_at);
  const expiresAt = body.expires_at === undefined ? new Date(current.expires_at) : new Date(body.expires_at);
  const status = body.status === undefined ? current.status : String(body.status).toLowerCase();
  const serviceName = body.service_name === undefined ? current.service_name : String(body.service_name || "").trim();
  const planName = body.plan_name === undefined ? current.plan_name : String(body.plan_name || "").trim();
  if (!serviceName || !planName || !validSubscriptionStatus(status)
      || Number.isNaN(startsAt.getTime()) || Number.isNaN(expiresAt.getTime()) || expiresAt <= startsAt) {
    return { status: 400, error: "validation_error" };
  }
  const item = await transaction(async (client) => {
    const updated = await client.query(
      `UPDATE subscriptions
          SET service_name=$3,plan_name=$4,start_date=$5,end_date=$6,status=$7,
              auto_renew=$8,metadata=$9::jsonb,updated_at=now()
        WHERE tenant_id=$1 AND id=$2
        RETURNING id,external_id AS "externalId",customer_id AS "customerId",order_number AS "orderNumber",
                  service_name AS "serviceName",plan_name AS "planName",start_date AS "startDate",
                  end_date AS "endDate",status,auto_renew AS "autoRenew",metadata,
                  created_at AS "createdAt",updated_at AS "updatedAt"`,
      [
        auth.tenantId,
        id,
        serviceName,
        planName,
        startsAt.toISOString().slice(0, 10),
        expiresAt.toISOString().slice(0, 10),
        status,
        body.renewal_policy === undefined ? current.renewal_policy === "AUTOMATIC" : body.renewal_policy === "AUTOMATIC",
        JSON.stringify(body.metadata === undefined ? current.metadata : body.metadata || {})
      ]
    );
    const shaped = subscriptionShape(updated.rows[0]);
    await publishCustomEvent(client, {
      tenantId: auth.tenantId,
      integrationId: auth.integrationId,
      type: "subscription.updated",
      resourceType: "subscription",
      resourceId: shaped.id,
      object: shaped
    });
    return shaped;
  });
  return { status: 200, body: { data: item, request_id: auth.requestId } };
}

function addCalendarDuration(date, value, unit) {
  const result = new Date(date);
  if (unit === "day") result.setUTCDate(result.getUTCDate() + value);
  if (unit === "month") result.setUTCMonth(result.getUTCMonth() + value);
  if (unit === "year") result.setUTCFullYear(result.getUTCFullYear() + value);
  return result;
}

export async function renewApiSubscription(auth, id, body) {
  const current = await findApiSubscription(auth, id);
  if (!current) return { status: 404, error: "resource_not_found" };
  const explicit = body.expires_at || body.new_expires_at;
  let newExpiry = explicit ? new Date(explicit) : null;
  if (!newExpiry) {
    const value = Number(body.duration_value);
    const unit = String(body.duration_unit || "");
    if (!Number.isInteger(value) || value < 1 || !["day", "month", "year"].includes(unit)) {
      return { status: 400, error: "validation_error" };
    }
    const currentExpiry = new Date(current.expires_at);
    const base = currentExpiry > new Date() ? currentExpiry : new Date();
    newExpiry = addCalendarDuration(base, value, unit);
  }
  if (Number.isNaN(newExpiry.getTime()) || newExpiry <= new Date(current.expires_at)) {
    return { status: 400, error: "validation_error" };
  }
  const item = await transaction(async (client) => {
    const updated = await client.query(
      `UPDATE subscriptions
          SET end_date=$3,status='renewed',renewed_at=now(),metadata=$4::jsonb,updated_at=now()
        WHERE tenant_id=$1 AND id=$2
        RETURNING id,external_id AS "externalId",customer_id AS "customerId",order_number AS "orderNumber",
                  service_name AS "serviceName",plan_name AS "planName",start_date AS "startDate",
                  end_date AS "endDate",status,auto_renew AS "autoRenew",metadata,
                  created_at AS "createdAt",updated_at AS "updatedAt"`,
      [
        auth.tenantId,
        id,
        newExpiry.toISOString().slice(0, 10),
        JSON.stringify({ ...(current.metadata || {}), ...(body.metadata || {}), last_renewal_source: "custom_api" })
      ]
    );
    const shaped = subscriptionShape(updated.rows[0]);
    await publishCustomEvent(client, {
      tenantId: auth.tenantId,
      integrationId: auth.integrationId,
      type: "subscription.renewed",
      resourceType: "subscription",
      resourceId: shaped.id,
      object: { ...shaped, renewed_at: new Date().toISOString() }
    });
    return shaped;
  });
  return { status: 200, body: { data: item, request_id: auth.requestId } };
}

export async function cancelApiSubscription(auth, id, body) {
  const current = await findApiSubscription(auth, id);
  if (!current) return { status: 404, error: "resource_not_found" };
  if (current.status === "cancelled") {
    return { status: 200, body: { data: current, request_id: auth.requestId } };
  }
  const item = await transaction(async (client) => {
    const updated = await client.query(
      `UPDATE subscriptions
          SET status='cancelled',auto_renew=false,
              metadata=$3::jsonb,updated_at=now()
        WHERE tenant_id=$1 AND id=$2
        RETURNING id,external_id AS "externalId",customer_id AS "customerId",order_number AS "orderNumber",
                  service_name AS "serviceName",plan_name AS "planName",start_date AS "startDate",
                  end_date AS "endDate",status,auto_renew AS "autoRenew",metadata,
                  created_at AS "createdAt",updated_at AS "updatedAt"`,
      [
        auth.tenantId,
        id,
        JSON.stringify({ ...(current.metadata || {}), cancellation_reason: String(body.reason || "").slice(0, 500), cancelled_via: "custom_api" })
      ]
    );
    const shaped = subscriptionShape(updated.rows[0]);
    await publishCustomEvent(client, {
      tenantId: auth.tenantId,
      integrationId: auth.integrationId,
      type: "subscription.cancelled",
      resourceType: "subscription",
      resourceId: shaped.id,
      object: shaped
    });
    return shaped;
  });
  return { status: 200, body: { data: item, request_id: auth.requestId } };
}
