import { query } from "../../../../../src/server/db.js";
import { requireSession } from "../../../../../src/server/session.js";
import {
  getSallaAccessToken,
  processSallaEvent,
  registerSallaOperationalWebhooks,
} from "../../../../../src/server/salla-app.js";

export async function POST(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const result = await query(`SELECT ac.id, ac.provider_store_id, ac.access_token_encrypted,
    ac.refresh_token_encrypted, ac.token_expires_at, ac.status,
    scs.auto_sync_customers, scs.auto_sync_orders
    FROM app_connections ac
    LEFT JOIN salla_connection_settings scs ON scs.connection_id = ac.id AND scs.tenant_id = ac.tenant_id
    WHERE ac.tenant_id = $1 AND ac.provider = 'salla' LIMIT 1`, [auth.session.tenantId]);
  const connection = result.rows[0];
  if (!connection || connection.status !== "connected") return Response.json({ ok: false, message: "اربط متجر سلة أولًا." }, { status: 409 });
  try {
    const token = await getSallaAccessToken(connection);
    const base = (process.env.SALLA_API_BASE_URL || "https://api.salla.dev/admin/v2").replace(/\/$/, "");
    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    try {
      await registerSallaOperationalWebhooks(token, origin);
    } catch (webhookError) {
      console.warn("Could not refresh Salla webhook registrations during sync", webhookError);
    }
    let synced = 0;
    let productPage = 1;
    let moreProducts = true;
    while (moreProducts && productPage <= 100) {
      const response = await fetch(`${base}/products?per_page=30&page=${productPage}`, { headers: { authorization: `Bearer ${token}`, accept: "application/json" } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(`Salla products request failed (${response.status})`);
      const products = Array.isArray(payload.data) ? payload.data : Array.isArray(payload.data?.data) ? payload.data.data : [];
      for (const product of products) {
        const variants = Array.isArray(product.variants) && product.variants.length ? product.variants : [null];
        for (const variant of variants) await query(
          `INSERT INTO salla_products
             (tenant_id,connection_id,salla_product_id,salla_variant_id,sku,name,price,currency,status,raw_payload,synced_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,now())
           ON CONFLICT (tenant_id,salla_product_id,COALESCE(salla_variant_id,'')) DO UPDATE SET
             sku=EXCLUDED.sku,name=EXCLUDED.name,price=EXCLUDED.price,currency=EXCLUDED.currency,
             status=EXCLUDED.status,raw_payload=EXCLUDED.raw_payload,synced_at=now()`,
          [auth.session.tenantId, connection.id, String(product.id), variant?.id ? String(variant.id) : null,
            variant?.sku || product.sku || null, variant?.name ? `${product.name} — ${variant.name}` : product.name,
            Number(variant?.price?.amount ?? product.price?.amount ?? product.price ?? 0) || null,
            variant?.price?.currency || product.price?.currency || "SAR", String(product.status || ""), JSON.stringify({ product, variant })]
        );
      }
      const current = Number(payload.pagination?.current_page || payload.meta?.current_page || productPage);
      const total = Number(payload.pagination?.total_pages || payload.meta?.last_page || current);
      moreProducts = products.length === 30 && current < total;
      productPage += 1;
    }
    if (connection.auto_sync_customers !== false) {
      const response = await fetch(`${base}/customers?per_page=50`, { headers: { authorization: `Bearer ${token}`, accept: "application/json" } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(`Salla customers request failed (${response.status})`);
      const customers = Array.isArray(payload.data) ? payload.data : Array.isArray(payload.data?.data) ? payload.data.data : [];
      for (const customer of customers) {
        const item = await processSallaEvent({ event: "customer.updated", merchant: connection.provider_store_id, data: customer });
        if (item.ok && !item.skipped) synced += 1;
      }
    }
    if (connection.auto_sync_orders !== false) {
      let page = 1;
      let hasMore = true;
      await query(`INSERT INTO salla_sync_cursors (tenant_id,connection_id,resource,import_status,send_notifications)
        VALUES ($1,$2,'orders','running',false) ON CONFLICT (tenant_id) DO UPDATE SET
        connection_id=EXCLUDED.connection_id,resource='orders',import_status='running',send_notifications=false,updated_at=now()`,
      [auth.session.tenantId, connection.id]);
      while (hasMore && page <= 100) {
        const response = await fetch(`${base}/orders?per_page=30&page=${page}`, { headers: { authorization: `Bearer ${token}`, accept: "application/json" } });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(`Salla orders request failed (${response.status})`);
        const orders = Array.isArray(payload.data) ? payload.data : Array.isArray(payload.data?.data) ? payload.data.data : [];
        for (const order of orders) {
          let historicalOrder = order;
          let paymentStatus = String(order.payment?.status?.slug || order.payment?.status || order.payment_status?.slug || order.payment_status || "").toLowerCase();
          if (!paymentStatus && order.id) {
            const detailResponse = await fetch(`${base}/orders/${encodeURIComponent(order.id)}`, { headers: { authorization: `Bearer ${token}`, accept: "application/json" } });
            const detailPayload = await detailResponse.json().catch(() => ({}));
            if (detailResponse.ok && detailPayload.data) {
              historicalOrder = detailPayload.data;
              paymentStatus = String(historicalOrder.payment?.status?.slug || historicalOrder.payment?.status || historicalOrder.payment_status?.slug || historicalOrder.payment_status || "").toLowerCase();
            }
          }
          if (!["paid", "completed", "success", "successful"].includes(paymentStatus)) continue;
          const item = await processSallaEvent({ event: "order.updated", merchant: connection.provider_store_id, data: historicalOrder }, { sendNotifications: false });
          if (item && !item.skipped) synced += 1;
        }
        await query("UPDATE salla_sync_cursors SET last_completed_page=$2,updated_at=now() WHERE tenant_id=$1", [auth.session.tenantId, page]);
        const current = Number(payload.pagination?.current_page || payload.meta?.current_page || page);
        const total = Number(payload.pagination?.total_pages || payload.meta?.last_page || current);
        hasMore = orders.length === 30 && current < total;
        page += 1;
      }
      await query("UPDATE salla_sync_cursors SET import_status='completed',updated_at=now() WHERE tenant_id=$1", [auth.session.tenantId]);
    }
    await query("UPDATE app_connections SET last_sync_at = now(), last_error = NULL, updated_at = now() WHERE id = $1", [connection.id]);
    return Response.json({ ok: true, synced });
  } catch (error) {
    await query("UPDATE app_connections SET last_error = $2, updated_at = now() WHERE id = $1", [connection.id, String(error.message).slice(0, 300)]);
    return Response.json({ ok: false, message: "تعذرت المزامنة، تحقق من صلاحيات الربط." }, { status: 502 });
  }
}
