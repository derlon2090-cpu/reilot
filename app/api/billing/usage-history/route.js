import { query } from "../../../../src/server/db.js";
import { requireSession } from "../../../../src/server/session.js";

export async function GET(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const history = await query(
    `SELECT mup.id, mup.period_start AS "periodStart", mup.period_end AS "periodEnd",
            mup.message_limit AS "limit", mup.used_messages AS "used",
            mup.reserved_messages AS "reserved", mup.whatsapp_used AS "whatsapp",
            mup.email_used AS "email", mup.sms_used AS "sms",
            pp.name AS "planName", pp.slug AS "planSlug"
       FROM message_usage_periods mup
       LEFT JOIN platform_plans pp ON pp.id = mup.plan_id
      WHERE mup.tenant_id = $1 ORDER BY mup.period_start DESC LIMIT 24`,
    [auth.session.tenantId]
  );
  return Response.json({ ok: true, items: history.rows.map((row) => ({
    ...row,
    limit: Number(row.limit),
    used: Number(row.used),
    reserved: Number(row.reserved),
    whatsapp: Number(row.whatsapp),
    email: Number(row.email),
    sms: Number(row.sms)
  })) });
}
