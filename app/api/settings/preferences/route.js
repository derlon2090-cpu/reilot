import { query } from "../../../../src/server/db.js";
import { requireSession } from "../../../../src/server/session.js";
import { preferencesSchema, validationResponse } from "../../../../src/server/settings-profile.js";

export async function GET(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  const result = await query(
    `SELECT language, theme, interface_density AS "interfaceDensity"
       FROM settings WHERE tenant_id = $1`,
    [auth.session.tenantId]
  );
  return Response.json({ ok: true, preferences: result.rows[0] || { language: "ar", theme: "light", interfaceDensity: "comfortable" } });
}

export async function PATCH(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  const parsed = preferencesSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationResponse(parsed);
  const result = await query(
    `INSERT INTO settings (tenant_id, language, theme, interface_density)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (tenant_id) DO UPDATE SET language = EXCLUDED.language,
       theme = EXCLUDED.theme, interface_density = EXCLUDED.interface_density, updated_at = now()
     RETURNING language, theme, interface_density AS "interfaceDensity"`,
    [auth.session.tenantId, parsed.data.language, parsed.data.theme, parsed.data.interfaceDensity]
  );
  await query(
    `INSERT INTO activity_logs (tenant_id, user_id, type, title)
     VALUES ($1, $2, 'preferences.updated', 'Interface preferences updated')`,
    [auth.session.tenantId, auth.session.userId]
  );
  return Response.json({ ok: true, preferences: result.rows[0] });
}
