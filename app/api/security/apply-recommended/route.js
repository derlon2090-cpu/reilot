import { transaction } from "../../../../src/server/db.js";
import { requireSession } from "../../../../src/server/session.js";

export async function POST(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  await transaction(async (client) => {
    await client.query(
      `INSERT INTO whatsapp_safety_settings
         (tenant_id, safe_mode_enabled, daily_message_limit, hourly_message_limit, stop_on_high_failure, stop_on_disconnected)
       VALUES ($1, true, 100, 20, true, true)
       ON CONFLICT (tenant_id) DO UPDATE SET
         safe_mode_enabled = true,
         daily_message_limit = CASE WHEN whatsapp_safety_settings.daily_message_limit > 0 THEN whatsapp_safety_settings.daily_message_limit ELSE 100 END,
         hourly_message_limit = CASE WHEN whatsapp_safety_settings.hourly_message_limit > 0 THEN whatsapp_safety_settings.hourly_message_limit ELSE 20 END,
         stop_on_high_failure = true, stop_on_disconnected = true, updated_at = now()`,
      [auth.session.tenantId]
    );
    await client.query(
      `INSERT INTO sending_schedule_settings
         (tenant_id, auto_whatsapp_delay_seconds, jitter_min_seconds, jitter_max_seconds, warmup_enabled, auto_pause_enabled)
       VALUES ($1, 300, 20, 90, true, true)
       ON CONFLICT (tenant_id) DO UPDATE SET
         auto_whatsapp_delay_seconds = GREATEST(sending_schedule_settings.auto_whatsapp_delay_seconds, 300),
         jitter_min_seconds = 20, jitter_max_seconds = 90,
         warmup_enabled = true, auto_pause_enabled = true, updated_at = now()`,
      [auth.session.tenantId]
    );
    await client.query(
      `INSERT INTO activity_logs (tenant_id, user_id, type, title)
       VALUES ($1, $2, 'security.safe_settings_applied', 'Recommended safe sending settings applied')`,
      [auth.session.tenantId, auth.session.userId]
    );
  });
  return Response.json({ ok: true });
}
