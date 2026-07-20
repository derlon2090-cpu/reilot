import crypto from "node:crypto";
import { del, put } from "@vercel/blob";
import { query } from "../../../../../src/server/db.js";
import { requireSession } from "../../../../../src/server/session.js";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const TYPES = {
  "image/png": { ext: "png", matches: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  "image/jpeg": { ext: "jpg", matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/webp": { ext: "webp", matches: (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP" }
};

async function currentAvatar(userId, tenantId) {
  const result = await query("SELECT image FROM users WHERE id = $1 AND tenant_id = $2", [userId, tenantId]);
  return result.rows[0]?.image || null;
}

async function deleteBlobSafely(url) {
  if (!url || !/^https:\/\/.+\.blob\.vercel-storage\.com\//i.test(url)) return;
  await del(url).catch(() => null);
}

export async function POST(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json({ ok: false, reason: "avatar_storage_not_configured", message: "تخزين الصور غير مهيأ حاليًا." }, { status: 503 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || typeof file.arrayBuffer !== "function") {
    return Response.json({ ok: false, reason: "file_required", message: "اختر صورة لرفعها." }, { status: 400 });
  }
  if (!file.size || file.size > MAX_IMAGE_BYTES) {
    return Response.json({ ok: false, reason: "file_too_large", message: "يجب ألا يتجاوز حجم الصورة 2 ميجابايت." }, { status: 400 });
  }
  const rule = TYPES[file.type];
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!rule || !rule.matches(bytes)) {
    return Response.json({ ok: false, reason: "invalid_file_type", message: "الصيغ المدعومة هي PNG وJPG وWebP فقط." }, { status: 400 });
  }

  const previous = await currentAvatar(auth.session.userId, auth.session.tenantId);
  const blob = await put(`avatars/${auth.session.userId}/${crypto.randomUUID()}.${rule.ext}`, bytes, {
    access: "public",
    addRandomSuffix: false,
    contentType: file.type
  });
  await query(
    "UPDATE users SET image = $1, updated_at = now() WHERE id = $2 AND tenant_id = $3",
    [blob.url, auth.session.userId, auth.session.tenantId]
  );
  await query(
    `INSERT INTO activity_logs (tenant_id, user_id, type, title)
     VALUES ($1, $2, 'avatar.updated', 'Profile avatar updated')`,
    [auth.session.tenantId, auth.session.userId]
  );
  await deleteBlobSafely(previous);
  return Response.json({ ok: true, avatarUrl: blob.url });
}

export async function DELETE(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  const previous = await currentAvatar(auth.session.userId, auth.session.tenantId);
  await query("UPDATE users SET image = NULL, updated_at = now() WHERE id = $1 AND tenant_id = $2", [auth.session.userId, auth.session.tenantId]);
  await query(
    `INSERT INTO activity_logs (tenant_id, user_id, type, title)
     VALUES ($1, $2, 'avatar.removed', 'Profile avatar removed')`,
    [auth.session.tenantId, auth.session.userId]
  );
  await deleteBlobSafely(previous);
  return Response.json({ ok: true });
}
