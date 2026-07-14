import { query, transaction } from "../../../../src/server/db.js";
import { requireSession } from "../../../../src/server/session.js";

const allowedChannels = new Set(["whatsapp", "email", "sms"]);
const variables = ["customer_name", "service_name", "end_date", "renewal_link"];

export async function GET(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const [template, rule] = await Promise.all([
    query(
      `SELECT id, name, channel, body, variables, is_active AS "isActive", updated_at AS "updatedAt"
         FROM notification_templates
        WHERE tenant_id = $1 AND trigger_type = 'before_expiry'
        ORDER BY updated_at DESC LIMIT 1`,
      [auth.session.tenantId]
    ),
    query(
      `SELECT ar.id, ar.days_offset AS "daysOffset", ar.is_active AS "isActive"
         FROM automation_rules ar
         JOIN notification_templates nt ON nt.id = ar.template_id
        WHERE ar.tenant_id = $1 AND nt.trigger_type = 'before_expiry'
        ORDER BY ar.updated_at DESC LIMIT 1`,
      [auth.session.tenantId]
    )
  ]);
  return Response.json({ ok: true, template: template.rows[0] || null, rule: rule.rows[0] || null });
}

export async function PUT(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const messageBody = String(body.body || "").trim();
  const channel = allowedChannels.has(body.channel) ? body.channel : "whatsapp";
  const daysOffset = Math.min(30, Math.max(0, Number(body.daysOffset || 7)));
  const isActive = body.isActive !== false;
  if (!name || !messageBody) return Response.json({ ok: false, message: "Template name and body are required" }, { status: 400 });

  const saved = await transaction(async (client) => {
    const existing = await client.query(
      `SELECT id FROM notification_templates
        WHERE tenant_id = $1 AND trigger_type = 'before_expiry'
        ORDER BY updated_at DESC LIMIT 1`,
      [auth.session.tenantId]
    );
    const template = existing.rows[0]
      ? await client.query(
          `UPDATE notification_templates
              SET name = $1, channel = $2, body = $3, variables = $4::jsonb,
                  is_active = $5, updated_at = now()
            WHERE id = $6 AND tenant_id = $7
          RETURNING id, name, channel, body, variables, is_active AS "isActive", updated_at AS "updatedAt"`,
          [name, channel, messageBody, JSON.stringify(variables), isActive, existing.rows[0].id, auth.session.tenantId]
        )
      : await client.query(
          `INSERT INTO notification_templates (tenant_id, name, channel, trigger_type, body, variables, is_active)
           VALUES ($1, $2, $3, 'before_expiry', $4, $5::jsonb, $6)
           RETURNING id, name, channel, body, variables, is_active AS "isActive", updated_at AS "updatedAt"`,
          [auth.session.tenantId, name, channel, messageBody, JSON.stringify(variables), isActive]
        );
    const templateId = template.rows[0].id;
    const existingRule = await client.query("SELECT id FROM automation_rules WHERE tenant_id = $1 AND template_id = $2 LIMIT 1", [auth.session.tenantId, templateId]);
    const rule = existingRule.rows[0]
      ? await client.query(
          `UPDATE automation_rules SET channel = $1, days_offset = $2, is_active = $3, updated_at = now()
            WHERE id = $4 AND tenant_id = $5
          RETURNING id, days_offset AS "daysOffset", is_active AS "isActive"`,
          [channel, daysOffset, isActive, existingRule.rows[0].id, auth.session.tenantId]
        )
      : await client.query(
          `INSERT INTO automation_rules (tenant_id, name, channel, trigger_type, days_offset, template_id, is_active)
           VALUES ($1, $2, $3, 'before_expiry', $4, $5, $6)
           RETURNING id, days_offset AS "daysOffset", is_active AS "isActive"`,
          [auth.session.tenantId, `${name} rule`, channel, daysOffset, templateId, isActive]
        );
    await client.query(
      "INSERT INTO activity_logs (tenant_id, user_id, type, title, metadata) VALUES ($1, $2, 'template.updated', 'Renewal template updated', $3::jsonb)",
      [auth.session.tenantId, auth.session.userId, JSON.stringify({ templateId, channel, daysOffset })]
    );
    return { template: template.rows[0], rule: rule.rows[0] };
  });
  return Response.json({ ok: true, ...saved });
}
