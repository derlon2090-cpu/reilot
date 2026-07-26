import { query } from "../../../../src/server/db.js";
import { requireSession } from "../../../../src/server/session.js";

export async function GET(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const history = await query(
    `SELECT mup.id, mup.period_start AS "periodStart", mup.period_end AS "periodEnd",
            mup.email_message_limit AS "limit", mup.email_used AS "used",
            mup.email_reserved AS "reserved",
            mup.used_messages AS "totalUsed", mup.reserved_messages AS "totalReserved",
            mup.whatsapp_message_limit AS "whatsappLimit",
            mup.whatsapp_used AS "whatsapp", mup.whatsapp_reserved AS "whatsappReserved",
            mup.email_message_limit AS "emailLimit",
            mup.email_used AS "email", mup.email_reserved AS "emailReserved",
            mup.sms_message_limit AS "smsLimit",
            mup.sms_used AS "sms", mup.sms_reserved AS "smsReserved",
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
    totalUsed: Number(row.totalUsed),
    totalReserved: Number(row.totalReserved),
    whatsappLimit: Number(row.whatsappLimit),
    whatsapp: Number(row.whatsapp),
    whatsappReserved: Number(row.whatsappReserved),
    emailLimit: Number(row.emailLimit),
    email: Number(row.email),
    emailReserved: Number(row.emailReserved),
    smsLimit: Number(row.smsLimit),
    sms: Number(row.sms),
    smsReserved: Number(row.smsReserved)
  })) });
}
