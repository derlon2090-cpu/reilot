import { query, transaction } from "../../../src/server/db.js";
import { requireSession } from "../../../src/server/session.js";

export async function GET(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const result = await query(
    `SELECT u.name, u.email, s.language, s.theme,
            COALESCE(s.notification_channels, '{}'::jsonb) AS "notificationChannels",
            COALESCE(s.security, '{}'::jsonb) AS security
       FROM users u LEFT JOIN settings s ON s.tenant_id = u.tenant_id
      WHERE u.id = $1 AND u.tenant_id = $2`,
    [auth.session.userId, auth.session.tenantId]
  );
  return Response.json({ ok: true, settings: result.rows[0] || null });
}

export async function PATCH(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => ({}));
  const language = body.language === "en" ? "en" : "ar";
  const theme = body.theme === "dark" ? "dark" : "light";
  const settings = await transaction(async (client) => {
    if (body.name && String(body.name).trim().length >= 2) {
      await client.query("UPDATE users SET name = $1, updated_at = now() WHERE id = $2 AND tenant_id = $3", [String(body.name).trim(), auth.session.userId, auth.session.tenantId]);
    }
    const saved = await client.query(
      `INSERT INTO settings (tenant_id, language, theme, notification_channels, security)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
       ON CONFLICT (tenant_id) DO UPDATE SET
         language = EXCLUDED.language, theme = EXCLUDED.theme,
         notification_channels = EXCLUDED.notification_channels,
         security = EXCLUDED.security, updated_at = now()
       RETURNING language, theme, notification_channels AS "notificationChannels", security`,
      [auth.session.tenantId, language, theme, JSON.stringify(body.notificationChannels || {}), JSON.stringify(body.security || {})]
    );
    await client.query(
      "INSERT INTO activity_logs (tenant_id, user_id, type, title) VALUES ($1, $2, 'settings.updated', 'Settings updated')",
      [auth.session.tenantId, auth.session.userId]
    );
    return saved.rows[0];
  });
  return Response.json({ ok: true, settings });
}
