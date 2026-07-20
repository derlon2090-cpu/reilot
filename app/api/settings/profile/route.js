import { transaction } from "../../../../src/server/db.js";
import { requireSession } from "../../../../src/server/session.js";
import { getSettingsProfile, profileSettingsSchema, validationResponse } from "../../../../src/server/settings-profile.js";

export async function GET(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  const profile = await getSettingsProfile(auth.session);
  return Response.json({ ok: true, profile });
}

export async function PATCH(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  const parsed = profileSettingsSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationResponse(parsed);

  const role = String(auth.session.role || "");
  if (parsed.data.storeName !== undefined && !["owner", "admin"].includes(role)) {
    return Response.json({ ok: false, reason: "store_name_forbidden" }, { status: 403 });
  }

  await transaction(async (client) => {
    await client.query(
      `UPDATE users SET name = $1, phone = $2, updated_at = now()
        WHERE id = $3 AND tenant_id = $4`,
      [parsed.data.fullName, parsed.data.phone ?? null, auth.session.userId, auth.session.tenantId]
    );
    if (parsed.data.storeName !== undefined && parsed.data.storeName !== null) {
      await client.query(
        `UPDATE stores SET name = $1, updated_at = now()
          WHERE id = (SELECT id FROM stores WHERE tenant_id = $2 ORDER BY created_at LIMIT 1)`,
        [parsed.data.storeName, auth.session.tenantId]
      );
      await client.query("UPDATE tenants SET name = $1, updated_at = now() WHERE id = $2", [parsed.data.storeName, auth.session.tenantId]);
    }
    await client.query(
      `INSERT INTO activity_logs (tenant_id, user_id, type, title)
       VALUES ($1, $2, 'profile.updated', 'Profile settings updated')`,
      [auth.session.tenantId, auth.session.userId]
    );
  });

  return Response.json({ ok: true, profile: await getSettingsProfile(auth.session) });
}
