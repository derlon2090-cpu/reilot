import { query } from "../../../../src/server/db.js";
import { requireSession } from "../../../../src/server/session.js";

const MAX_IMAGE_BYTES = 512 * 1024;

export async function POST(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => ({}));
  const image = String(body.image || "");
  const match = image.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return Response.json({ ok: false, message: "صيغة الصورة غير مدعومة." }, { status: 400 });
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) {
    return Response.json({ ok: false, message: "يجب ألا يتجاوز حجم الصورة 512 كيلوبايت." }, { status: 400 });
  }
  await query("UPDATE users SET image = $1, updated_at = now() WHERE id = $2 AND tenant_id = $3", [image, auth.session.userId, auth.session.tenantId]);
  await query("INSERT INTO activity_logs (tenant_id, user_id, type, title) VALUES ($1, $2, 'profile.image.updated', 'Profile image updated')", [auth.session.tenantId, auth.session.userId]);
  return Response.json({ ok: true, image });
}

export async function DELETE(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  await query("UPDATE users SET image = NULL, updated_at = now() WHERE id = $1 AND tenant_id = $2", [auth.session.userId, auth.session.tenantId]);
  await query("INSERT INTO activity_logs (tenant_id, user_id, type, title) VALUES ($1, $2, 'profile.image.removed', 'Profile image removed')", [auth.session.tenantId, auth.session.userId]);
  return Response.json({ ok: true });
}
