import { whatsappHealthScore, warmupDailyLimit } from "../../../../src/lib/messageSafety.js";
import { query } from "../../../../src/server/db.js";
import { requireSession } from "../../../../src/server/session.js";

export async function GET(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const result = await query(
    `SELECT wc.id, wc.status, wc.phone_number AS "phoneNumber", wc.daily_sent AS "messagesToday",
            wc.hourly_sent AS "messagesHour", wc.failure_rate AS "failureRate", wc.last_disconnect_at AS "lastDisconnect",
            wc.warmup_day AS "warmupDay",
            (SELECT count(*)::int FROM unsubscribe_list ul WHERE ul.tenant_id = wc.tenant_id AND ul.unsubscribed_at >= current_date) AS "unsubscribeCount"
       FROM whatsapp_channels wc WHERE wc.tenant_id = $1 ORDER BY wc.created_at DESC LIMIT 1`,
    [auth.session.tenantId]
  );
  const channel = result.rows[0];
  if (!channel) return Response.json({ ok: true, connected: false, health: null });
  const score = whatsappHealthScore({
    failureRate: channel.failureRate,
    unsubscribeCount: channel.unsubscribeCount,
    disconnected: channel.status !== "connected",
    hourlySent: channel.messagesHour
  });
  const dailyLimit = warmupDailyLimit(channel.warmupDay);
  const advice = channel.messagesToday >= dailyLimit
    ? "لا ترفع الإرسال اليومي اليوم؛ اكتمل حد التدرج الآمن."
    : score.risk > 35 ? "خفّض الإرسال لمدة 24 ساعة وراجع الرسائل الفاشلة." : "صحة الرقم مستقرة، استمر ضمن حدود الإرسال الآمن.";
  return Response.json({ ok: true, connected: channel.status === "connected", health: { ...channel, ...score, dailyLimit, advice } });
}
