import crypto from "node:crypto";
import { del, put } from "@vercel/blob";
import { query, transaction } from "../../../../../src/server/db.js";
import { ensureOrderLinkProfile } from "../../../../../src/server/order-links.js";
import { requireSession } from "../../../../../src/server/session.js";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const TYPES = {
  "image/png": { ext: "png", matches: (bytes) => bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 },
  "image/jpeg": { ext: "jpg", matches: (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  "image/webp": { ext: "webp", matches: (bytes) => bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP" }
};

async function removeManagedBlob(url) {
  if (!url || !/^https:\/\/.+\.blob\.vercel-storage\.com\//i.test(url)) return;
  await del(url).catch(() => null);
}

export async function POST(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json({ ok: false, reason: "store_logo_storage_not_configured", message: "تخزين صور المتجر غير مهيأ حاليًا." }, { status: 503 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || typeof file.arrayBuffer !== "function") {
    return Response.json({ ok: false, reason: "file_required", message: "اختر صورة المتجر لرفعها." }, { status: 400 });
  }
  if (!file.size || file.size > MAX_IMAGE_BYTES) {
    return Response.json({ ok: false, reason: "file_too_large", message: "يجب ألا يتجاوز حجم صورة المتجر 2 ميجابايت." }, { status: 400 });
  }

  const rule = TYPES[file.type];
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!rule || !rule.matches(bytes)) {
    return Response.json({ ok: false, reason: "invalid_file_type", message: "الصيغ المدعومة لصورة المتجر هي PNG وJPG وWebP فقط." }, { status: 400 });
  }

  const profile = await ensureOrderLinkProfile(auth.session.tenantId);
  const blob = await put(`store-logos/${auth.session.tenantId}/${crypto.randomUUID()}.${rule.ext}`, bytes, {
    access: "public",
    addRandomSuffix: false,
    contentType: file.type
  });
  try {
    await transaction(async (client) => {
      await client.query("UPDATE order_link_profiles SET logo_url=$1,updated_at=now() WHERE tenant_id=$2", [blob.url, auth.session.tenantId]);
      await client.query(
        `INSERT INTO activity_logs (tenant_id,user_id,type,title,metadata)
         VALUES ($1,$2,'store_logo.updated','Store logo updated',$3::jsonb)`,
        [auth.session.tenantId, auth.session.userId, JSON.stringify({ profileId: profile.id })]
      );
    });
  } catch (error) {
    await removeManagedBlob(blob.url);
    throw error;
  }
  await removeManagedBlob(profile.logoUrl);
  return Response.json({ ok: true, logoUrl: blob.url });
}

export async function DELETE(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  const profile = await ensureOrderLinkProfile(auth.session.tenantId);
  await query("UPDATE order_link_profiles SET logo_url=NULL,updated_at=now() WHERE tenant_id=$1", [auth.session.tenantId]);
  await query(
    `INSERT INTO activity_logs (tenant_id,user_id,type,title)
     VALUES ($1,$2,'store_logo.removed','Store logo removed')`,
    [auth.session.tenantId, auth.session.userId]
  );
  await removeManagedBlob(profile.logoUrl);
  return Response.json({ ok: true });
}
