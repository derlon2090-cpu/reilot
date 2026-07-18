import { query } from "../../../../../src/server/db.js";
import { requireSession } from "../../../../../src/server/session.js";
import { addWhatsAppActivity, createChannel, evolutionInstanceName, latestTenantChannel, withoutExpiredQr } from "../../../../../src/server/whatsapp-repository.js";

export async function GET(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  return Response.json({ ok: true, instance: withoutExpiredQr(await latestTenantChannel(auth.session.tenantId)) });
}

export async function POST(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const existing = await latestTenantChannel(auth.session.tenantId);
  if (existing) {
    return Response.json({ ok: true, instance: withoutExpiredQr(existing), existing: true });
  }
  const capacity = await query(
    `SELECT COALESCE(pp.whatsapp_channels_limit, 1) AS channel_limit,
            (SELECT count(*)::int FROM whatsapp_channels wc WHERE wc.tenant_id = $1) AS channel_count
       FROM platform_subscriptions ps
       JOIN platform_plans pp ON pp.id = ps.plan_id
      WHERE ps.tenant_id = $1 AND ps.status IN ('trial', 'active')
      ORDER BY ps.current_period_end DESC LIMIT 1`,
    [auth.session.tenantId]
  );
  const limits = capacity.rows[0] || { channel_limit: 1, channel_count: 0 };
  if (Number(limits.channel_count) >= Number(limits.channel_limit)) {
    return Response.json({ ok: false, code: "plan_limit_reached", message: "WhatsApp channel limit reached for the current plan." }, { status: 403 });
  }
  try {
    const instanceName = evolutionInstanceName(auth.session.tenantId);
    const channel = await createChannel({
      tenantId: auth.session.tenantId,
      instanceName,
      qrBase64: null
    });
    await addWhatsAppActivity({ tenantId: auth.session.tenantId, userId: auth.session.userId, type: "whatsapp.channel_created", title: "WhatsApp linking channel created" });
    return Response.json({ ok: true, instance: channel }, { status: 201 });
  } catch (error) {
    console.error("WhatsApp channel create failed", error?.name || "unknown_error");
    return Response.json({ ok: false, message: "تعذر إنشاء قناة الربط حاليًا." }, { status: 500 });
  }
}
