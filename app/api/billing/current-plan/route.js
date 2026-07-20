import { getCurrentMessageUsage } from "../../../../src/lib/billing/message-quota.js";
import { query } from "../../../../src/server/db.js";
import { requireSession } from "../../../../src/server/session.js";

export async function GET(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const usage = await getCurrentMessageUsage(auth.session.tenantId);
  const plan = await query(
    `SELECT pp.name, pp.slug, pp.monthly_message_limit AS "monthlyMessageLimit",
            pp.whatsapp_message_limit AS "whatsappMessageLimit",
            pp.email_message_limit AS "emailMessageLimit", pp.sms_message_limit AS "smsMessageLimit",
            ps.status, ps.billing_cycle AS "billingCycle",
            ps.current_period_start AS "currentPeriodStart", ps.current_period_end AS "currentPeriodEnd"
       FROM platform_subscriptions ps
       JOIN platform_plans pp ON pp.id = ps.plan_id
      WHERE ps.id = $1 AND ps.tenant_id = $2 LIMIT 1`,
    [usage.platformSubscriptionId, auth.session.tenantId]
  );
  return Response.json({ ok: true, plan: plan.rows[0] || null });
}
