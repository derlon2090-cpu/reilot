import { parseSpreadsheetText, previewSubscriptionImport } from "../../../../src/lib/subscriptionImport.js";
import { transaction } from "../../../../src/server/db.js";
import { requireSession } from "../../../../src/server/session.js";

export async function POST(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const body = await req.json();
  const rows = Array.isArray(body.rows) ? body.rows : parseSpreadsheetText(body.text);
  const preview = previewSubscriptionImport(rows);
  if (!preview.validCount) return Response.json({ ok: false, preview }, { status: 422 });

  const saved = await transaction(async (client) => {
    let count = 0;
    for (const row of preview.validRows) {
      const customer = await client.query(
        `INSERT INTO customers (tenant_id, name, phone, whatsapp_number)
         SELECT $1, $2, $3, $3
          WHERE NOT EXISTS (SELECT 1 FROM customers WHERE tenant_id = $1 AND whatsapp_number = $3)
         RETURNING id`,
        [auth.session.tenantId, row.customerName, row.phoneNumber]
      );
      let customerId = customer.rows[0]?.id;
      if (!customerId) {
        const existing = await client.query(
          "SELECT id FROM customers WHERE tenant_id = $1 AND whatsapp_number = $2 ORDER BY created_at LIMIT 1",
          [auth.session.tenantId, row.phoneNumber]
        );
        customerId = existing.rows[0]?.id;
      }
      if (!customerId) continue;
      const inserted = await client.query(
        `INSERT INTO subscriptions (tenant_id, customer_id, order_number, service_name, plan_name, start_date, end_date, renewal_url, status)
         VALUES ($1, $2, $3, $4, $4, $5, $6, $7, CASE WHEN $6::date < current_date THEN 'expired' ELSE 'active' END)
         ON CONFLICT (tenant_id, order_number) DO NOTHING`,
        [auth.session.tenantId, customerId, row.orderNumber, row.serviceName, row.startDate, row.endDate, row.renewalUrl || null]
      );
      count += inserted.rowCount;
    }
    await client.query(
      `INSERT INTO activity_logs (tenant_id, user_id, type, title, metadata)
       VALUES ($1, $2, 'subscriptions.imported', 'Subscriptions imported', $3::jsonb)`,
      [auth.session.tenantId, auth.session.userId, JSON.stringify({ saved: count, rejected: preview.invalidCount })]
    );
    return count;
  });
  return Response.json({ ok: true, saved, preview });
}
