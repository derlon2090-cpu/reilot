import { query } from "../../../src/server/db.js";
import { requireSession } from "../../../src/server/session.js";

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function configuredEmailSender() {
  const value = String(process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || "").trim();
  if (!value) return null;
  const match = value.match(/<?([^<>\s]+@[^<>\s]+)>?$/);
  return match?.[1] || null;
}

export async function GET(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;

  const tenantId = auth.session.tenantId;
  const [whatsapp, totals, daily, activity] = await Promise.all([
    query(
      `SELECT id, provider, status, phone_number AS "phoneNumber",
              COALESCE(NULLIF(display_name,''), NULLIF(device_name,''), NULLIF(phone_number,''), 'واتساب الرسمية') AS name,
              connected_at AS "connectedAt", last_health_check_at AS "lastHealthCheckAt", updated_at AS "updatedAt"
         FROM whatsapp_channels
        WHERE tenant_id=$1 AND provider IN ('meta','meta_cloud','meta_cloud_api')
        ORDER BY CASE status WHEN 'connected' THEN 0 ELSE 1 END, updated_at DESC`,
      [tenantId]
    ),
    query(
      `SELECT
          count(*)::int AS "totalMessages",
          count(*) FILTER (WHERE status IN ('sent','delivered','read'))::int AS sent,
          count(*) FILTER (WHERE status IN ('delivered','read'))::int AS delivered,
          count(*) FILTER (WHERE status='read')::int AS opened,
          count(*) FILTER (WHERE status IN ('failed','bounced'))::int AS failed,
          count(*) FILTER (WHERE channel='whatsapp')::int AS "whatsappMessages",
          count(*) FILTER (WHERE channel='email')::int AS "emailMessages"
         FROM notification_logs WHERE tenant_id=$1`,
      [tenantId]
    ),
    query(
      `SELECT days.day::date AS day,
              count(nl.id)::int AS sent,
              count(nl.id) FILTER (WHERE nl.status IN ('delivered','read'))::int AS delivered
         FROM generate_series(current_date - interval '29 days', current_date, interval '1 day') days(day)
         LEFT JOIN notification_logs nl ON nl.tenant_id=$1 AND nl.created_at::date=days.day::date
        GROUP BY days.day ORDER BY days.day`,
      [tenantId]
    ),
    query(
      `SELECT id, channel, status, to_number AS "recipient", sent_at AS "sentAt", created_at AS "createdAt",
              error_message AS "errorMessage"
         FROM notification_logs WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 8`,
      [tenantId]
    )
  ]);

  const metrics = totals.rows[0] || {};
  const sent = number(metrics.sent);
  const delivered = number(metrics.delivered);
  const opened = number(metrics.opened);
  const emailSender = configuredEmailSender();
  const emailConfigured = Boolean(process.env.RESEND_API_KEY && emailSender);
  const whatsappItems = whatsapp.rows;
  const connectedWhatsApp = whatsappItems.filter((item) => item.status === "connected");

  return Response.json({
    ok: true,
    summary: {
      connectedChannels: connectedWhatsApp.length + (emailConfigured ? 1 : 0),
      verifiedDomains: emailConfigured ? 1 : 0,
      activeSenders: emailConfigured ? 1 : 0,
      totalMessages: number(metrics.totalMessages),
      sent,
      delivered,
      failed: number(metrics.failed),
      deliveryRate: sent > 0 ? Number(((delivered / sent) * 100).toFixed(1)) : null,
      openRate: sent > 0 ? Number(((opened / sent) * 100).toFixed(1)) : null,
      whatsappMessages: number(metrics.whatsappMessages),
      emailMessages: number(metrics.emailMessages)
    },
    channels: {
      whatsapp: {
        connected: connectedWhatsApp.length > 0,
        items: whatsappItems
      },
      email: {
        connected: emailConfigured,
        sender: emailSender,
        domain: emailSender?.split("@")[1] || null
      }
    },
    dailyPerformance: daily.rows.map((row) => ({
      day: row.day,
      sent: number(row.sent),
      delivered: number(row.delivered)
    })),
    activity: activity.rows
  });
}
