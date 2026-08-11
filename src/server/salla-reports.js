import { query } from "./db.js";

const SUCCESSFUL_DELIVERY_STATUSES = new Set(["accepted", "sent", "delivered", "read"]);

function text(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function finiteAmount(value) {
  const candidate = value && typeof value === "object" ? value.amount ?? value.value : value;
  const number = Number(candidate);
  return Number.isFinite(number) ? number : null;
}

function eventData(payload = {}) {
  return payload?.data && typeof payload.data === "object" ? payload.data : {};
}

function eventCartId(payload = {}) {
  const data = eventData(payload);
  return text(data?.cart?.id || data?.cart_id || (String(payload?.event || "").includes("cart") ? data?.id : ""));
}

function eventOrderId(payload = {}) {
  const data = eventData(payload);
  return text(data?.order?.id || data?.order_id || (String(payload?.event || "").startsWith("order.") ? data?.id : ""));
}

function cartSnapshot(payload = {}) {
  const data = eventData(payload);
  const cart = data?.cart && typeof data.cart === "object" ? data.cart : data;
  const customer = cart?.customer || data?.customer || cart?.buyer || {};
  const total = finiteAmount(cart?.total ?? cart?.total_amount ?? cart?.amount ?? data?.total);
  const items = Array.isArray(cart?.items) ? cart.items : Array.isArray(data?.items) ? data.items : [];
  return {
    customerName: text(customer?.name || customer?.full_name || customer?.first_name),
    customerEmail: text(customer?.email),
    customerPhone: text(customer?.mobile || customer?.phone),
    total,
    currency: text(cart?.currency || data?.currency || cart?.total?.currency),
    items: items.map((item) => ({
      name: text(item?.name || item?.product?.name),
      quantity: Number.isFinite(Number(item?.quantity)) ? Number(item.quantity) : null,
      price: finiteAmount(item?.price || item?.amount),
      image: text(item?.image || item?.product?.image)
    })).filter((item) => item.name || item.quantity !== null || item.price !== null),
    checkoutUrl: text(cart?.checkout_url || data?.checkout_url || cart?.url),
    abandonedAt: text(payload?.created_at || data?.created_at || cart?.created_at)
  };
}

function orderAmount(payload = {}) {
  const data = eventData(payload);
  const order = data?.order && typeof data.order === "object" ? data.order : data;
  return {
    amount: finiteAmount(order?.total ?? order?.total_amount ?? order?.amount ?? data?.total),
    currency: text(order?.currency || data?.currency || order?.total?.currency),
    orderNumber: text(order?.reference_id || order?.number || data?.order_number)
  };
}

function dateBounds({ period = "30", dateFrom = "", dateTo = "" } = {}) {
  const allowed = new Set(["7", "30", "90", "custom"]);
  const selected = allowed.has(String(period)) ? String(period) : "30";
  const now = new Date();
  const end = selected === "custom" && dateTo ? new Date(`${dateTo}T23:59:59.999Z`) : now;
  const start = selected === "custom" && dateFrom
    ? new Date(`${dateFrom}T00:00:00.000Z`)
    : new Date(end.getTime() - Number(selected === "custom" ? 30 : selected) * 86400000);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end) {
    const error = new Error("الفترة المحددة غير صالحة.");
    error.status = 400;
    throw error;
  }
  return { start, end, period: selected };
}

function cartState(row, deliveries) {
  const successful = deliveries.some((item) => SUCCESSFUL_DELIVERY_STATUSES.has(String(item.status || "")));
  if (row.status === "cancelled") return "excluded";
  if (row.status === "expired") return "expired";
  if (row.convertedOrderId && successful) return "recovered";
  if (row.convertedOrderId) return "purchased_later";
  if (successful || deliveries.length) return "recovering";
  return "abandoned";
}

function timelineFor(items) {
  const days = new Map();
  items.forEach((item) => {
    const key = new Date(item.abandonedAt).toISOString().slice(0, 10);
    const current = days.get(key) || { date: key, abandoned: 0, recovered: 0, recoveredValue: 0, hasRecoveredValue: false };
    current.abandoned += 1;
    if (item.state === "recovered") {
      current.recovered += 1;
      if (item.recoveredValue !== null) {
        current.recoveredValue += item.recoveredValue;
        current.hasRecoveredValue = true;
      }
    }
    days.set(key, current);
  });
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date)).map((item) => ({
    date: item.date,
    abandoned: item.abandoned,
    recovered: item.recovered,
    recoveredValue: item.hasRecoveredValue ? item.recoveredValue : null
  }));
}

export async function getSallaReports({ tenantId, filters = {} }) {
  const connection = await query(
    `SELECT id,provider_store_name AS "storeName",provider_store_id AS "storeId",status,last_sync_at AS "lastSyncAt"
       FROM app_connections
      WHERE tenant_id=$1 AND provider='salla' AND status='connected'
      ORDER BY updated_at DESC LIMIT 1`,
    [tenantId]
  );
  if (!connection.rows[0]) return { available: false, store: null, summary: null, timeline: [], items: [] };

  const bounds = dateBounds(filters);
  const sequences = await query(
    `SELECT sequence.id,sequence.external_cart_id AS "externalCartId",sequence.status,
            sequence.converted_order_id AS "convertedOrderId",sequence.created_at AS "createdAt",
            sequence.updated_at AS "updatedAt",sequence.completed_at AS "completedAt",
            sequence.cancelled_at AS "cancelledAt",orders.order_number AS "orderNumber",
            orders.total_amount AS "storedOrderAmount",orders.currency AS "storedOrderCurrency",
            customers.id AS "customerId",customers.name AS "storedCustomerName",
            customers.email AS "storedCustomerEmail",customers.phone AS "storedCustomerPhone"
       FROM abandoned_cart_sequences sequence
       LEFT JOIN external_orders orders ON orders.tenant_id=sequence.tenant_id
        AND orders.provider='salla' AND orders.external_order_id=sequence.converted_order_id
       LEFT JOIN customers ON customers.id=orders.customer_id AND customers.tenant_id=sequence.tenant_id
      WHERE sequence.tenant_id=$1 AND sequence.created_at >= $2 AND sequence.created_at <= $3
      ORDER BY sequence.created_at DESC LIMIT 5000`,
    [tenantId, bounds.start, bounds.end]
  );
  const cartIds = sequences.rows.map((item) => item.externalCartId);
  const orderIds = sequences.rows.map((item) => item.convertedOrderId).filter(Boolean);
  const deliveries = cartIds.length ? await query(
    `SELECT id,external_cart_id AS "externalCartId",external_order_id AS "externalOrderId",channel,status,
            attempts,queued_at AS "queuedAt",accepted_at AS "acceptedAt",sent_at AS "sentAt",
            delivered_at AS "deliveredAt",read_at AS "readAt",failed_at AS "failedAt",
            failure_code AS "failureCode",failure_message_safe AS "failureMessage",created_at AS "createdAt"
       FROM salla_template_deliveries
      WHERE tenant_id=$1 AND external_cart_id = ANY($2::text[])
      ORDER BY created_at`,
    [tenantId, cartIds]
  ) : { rows: [] };
  const events = cartIds.length ? await query(
    `SELECT event_type AS "eventType",payload,created_at AS "createdAt"
       FROM webhook_events
      WHERE tenant_id=$1 AND provider='salla'
        AND (event_type='abandoned.cart' OR event_type LIKE 'order.%')
        AND created_at >= $2 AND created_at <= $3
      ORDER BY created_at`,
    [tenantId, new Date(bounds.start.getTime() - 86400000), new Date(bounds.end.getTime() + 30 * 86400000)]
  ) : { rows: [] };

  const deliveriesByCart = new Map();
  deliveries.rows.forEach((item) => {
    const list = deliveriesByCart.get(item.externalCartId) || [];
    list.push(item);
    deliveriesByCart.set(item.externalCartId, list);
  });
  const cartEvents = new Map();
  const orderEvents = new Map();
  events.rows.forEach((item) => {
    const cartId = eventCartId(item.payload);
    const orderId = eventOrderId(item.payload);
    if (cartId && item.eventType === "abandoned.cart") cartEvents.set(cartId, item.payload);
    if (orderId && String(item.eventType).startsWith("order.")) orderEvents.set(orderId, item.payload);
  });

  let items = sequences.rows.map((row) => {
    const cartPayload = cartEvents.get(row.externalCartId) || {};
    const snapshot = cartSnapshot(cartPayload);
    const cartDeliveries = deliveriesByCart.get(row.externalCartId) || [];
    const state = cartState(row, cartDeliveries);
    const order = orderAmount(orderEvents.get(row.convertedOrderId) || {});
    const storedAmount = finiteAmount(row.storedOrderAmount);
    const recoveredValue = state === "recovered" ? (storedAmount ?? order.amount) : null;
    const latestAttempt = cartDeliveries.at(-1) || null;
    const channel = latestAttempt?.channel || null;
    return {
      id: row.id,
      externalCartId: row.externalCartId,
      state,
      customerId: row.customerId || null,
      customerName: text(row.storedCustomerName || snapshot.customerName) || null,
      customerEmail: text(row.storedCustomerEmail || snapshot.customerEmail) || null,
      customerPhone: text(row.storedCustomerPhone || snapshot.customerPhone) || null,
      cartValue: snapshot.total,
      currency: text(snapshot.currency || row.storedOrderCurrency || order.currency) || null,
      abandonedAt: snapshot.abandonedAt || row.createdAt,
      lastUpdatedAt: row.updatedAt,
      channel,
      lastAttemptAt: latestAttempt?.readAt || latestAttempt?.deliveredAt || latestAttempt?.sentAt || latestAttempt?.acceptedAt || latestAttempt?.queuedAt || latestAttempt?.createdAt || null,
      convertedOrderId: row.convertedOrderId || null,
      orderNumber: row.orderNumber || order.orderNumber || null,
      recoveredValue,
      items: snapshot.items,
      deliveries: cartDeliveries.map((item) => ({
        id: item.id,
        channel: item.channel,
        status: item.status,
        attempts: item.attempts,
        at: item.readAt || item.deliveredAt || item.sentAt || item.acceptedAt || item.queuedAt || item.createdAt,
        failureCode: item.failureCode || null,
        failureMessage: item.failureMessage || null
      }))
    };
  });

  const search = text(filters.search).toLowerCase();
  const selectedState = text(filters.status);
  const selectedChannel = text(filters.channel);
  const minValue = filters.minValue === "" || filters.minValue === undefined ? null : finiteAmount(filters.minValue);
  const maxValue = filters.maxValue === "" || filters.maxValue === undefined ? null : finiteAmount(filters.maxValue);
  items = items.filter((item) => {
    const haystack = [item.customerName, item.customerEmail, item.customerPhone, item.orderNumber, item.externalCartId].filter(Boolean).join(" ").toLowerCase();
    if (search && !haystack.includes(search)) return false;
    if (selectedState && selectedState !== "all" && item.state !== selectedState) return false;
    if (selectedChannel && selectedChannel !== "all" && item.channel !== selectedChannel) return false;
    const value = item.cartValue ?? item.recoveredValue;
    if (minValue !== null && (value === null || value < minValue)) return false;
    if (maxValue !== null && (value === null || value > maxValue)) return false;
    return true;
  });

  const recovered = items.filter((item) => item.state === "recovered");
  const knownValues = recovered.map((item) => item.recoveredValue).filter((value) => value !== null);
  const channelCounts = new Map();
  recovered.forEach((item) => item.channel && channelCounts.set(item.channel, (channelCounts.get(item.channel) || 0) + 1));
  const bestChannel = [...channelCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  return {
    available: true,
    store: connection.rows[0],
    period: { from: bounds.start.toISOString(), to: bounds.end.toISOString(), key: bounds.period },
    summary: {
      abandoned: items.length,
      recovered: recovered.length,
      recoveredValue: knownValues.length ? knownValues.reduce((sum, value) => sum + value, 0) : null,
      recoveryRate: items.length ? (recovered.length / items.length) * 100 : null,
      averageRecoveredValue: knownValues.length ? knownValues.reduce((sum, value) => sum + value, 0) / knownValues.length : null,
      bestChannel
    },
    timeline: timelineFor(items),
    items
  };
}

export async function excludeSallaCart({ tenantId, cartId }) {
  const result = await query(
    `UPDATE abandoned_cart_sequences SET status='cancelled',cancelled_at=now(),updated_at=now()
      WHERE id=$1 AND tenant_id=$2 AND status NOT IN ('converted','completed')
      RETURNING id`,
    [cartId, tenantId]
  );
  if (!result.rows[0]) {
    const error = new Error("لا يمكن استبعاد هذه السلة أو أنها لم تعد متاحة.");
    error.status = 409;
    throw error;
  }
  await query(
    `UPDATE message_queue queue SET status='cancelled',last_error='cart_excluded_by_user',updated_at=now()
      FROM salla_template_deliveries delivery
     WHERE delivery.message_queue_id=queue.id AND delivery.tenant_id=$1
       AND delivery.external_cart_id=(SELECT external_cart_id FROM abandoned_cart_sequences WHERE id=$2 AND tenant_id=$1)
       AND queue.status='pending'`,
    [tenantId, cartId]
  );
  return { ok: true };
}

export const __sallaReportInternals = { cartSnapshot, orderAmount, cartState, dateBounds };
