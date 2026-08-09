import crypto from "node:crypto";
import { del, put } from "@vercel/blob";
import { auditAdmin, requireAdminPermission } from "../../../../../../../../src/server/admin-auth.js";
import { appBaseUrl } from "../../../../../../../../src/server/app-url.js";
import { sameOriginRequest } from "../../../../../../../../src/server/campaign-contacts.js";
import { query } from "../../../../../../../../src/server/db.js";
import { SALLA_TEMPLATE_DEFINITIONS } from "../../../../../../../../src/server/salla-templates.js";

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

function databaseImageUrl(imageId, revision) {
  return `${appBaseUrl()}/api/public/platform-salla-template-image/${encodeURIComponent(imageId)}?v=${encodeURIComponent(revision)}`;
}

export async function POST(request, { params }) {
  const auth = await requireAdminPermission(request, "integrations", "update");
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير موثوق." }, { status: 403 });

  try {
    const { templateKey } = await params;
    if (!SALLA_TEMPLATE_DEFINITIONS.some((item) => item.key === templateKey)) {
      return Response.json({ ok: false, message: "قالب سلة غير معروف." }, { status: 404 });
    }
    const formData = await request.formData().catch(() => null);
    const file = formData?.get("file");
    if (!file || typeof file.arrayBuffer !== "function") {
      return Response.json({ ok: false, message: "اختر صورة رسالة واتساب لرفعها." }, { status: 400 });
    }
    if (!file.size || file.size > MAX_IMAGE_BYTES) {
      return Response.json({ ok: false, message: "يجب ألا يتجاوز حجم صورة رسالة واتساب 2 ميجابايت." }, { status: 400 });
    }
    const rule = TYPES[file.type];
    const bytes = Buffer.from(await file.arrayBuffer());
    if (!rule || !rule.matches(bytes)) {
      return Response.json({ ok: false, message: "الصيغ المدعومة هي PNG وJPG وWebP فقط." }, { status: 400 });
    }

    const current = await query(
      `SELECT id,image_url AS "imageUrl" FROM platform_salla_template_images WHERE template_key=$1 LIMIT 1`,
      [templateKey]
    );
    const imageId = current.rows[0]?.id || crypto.randomUUID();
    const revision = crypto.randomUUID();
    const useBlobStorage = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
    const blob = useBlobStorage
      ? await put(`platform-salla-template-images/${templateKey}/${revision}.${rule.ext}`, bytes, {
          access: "public",
          addRandomSuffix: false,
          contentType: file.type
        })
      : null;
    const imageUrl = blob?.url || databaseImageUrl(imageId, revision);

    try {
      await query(
        `INSERT INTO platform_salla_template_images
           (id,template_key,image_url,image_data,image_content_type,updated_at)
         VALUES ($1,$2,$3,$4,$5,now())
         ON CONFLICT (template_key) DO UPDATE SET
           image_url=EXCLUDED.image_url,image_data=EXCLUDED.image_data,
           image_content_type=EXCLUDED.image_content_type,updated_at=now()`,
        [imageId, templateKey, imageUrl, useBlobStorage ? null : bytes, useBlobStorage ? null : file.type]
      );
    } catch (error) {
      await removeManagedBlob(blob?.url);
      throw error;
    }
    if (current.rows[0]?.imageUrl !== imageUrl) await removeManagedBlob(current.rows[0]?.imageUrl);
    await auditAdmin(request, {
      admin: auth.admin,
      action: "admin.salla.default_template.image_updated",
      resource: templateKey,
      metadata: { storage: useBlobStorage ? "vercel_blob" : "database" }
    });
    return Response.json({ ok: true, imageUrl, storage: useBlobStorage ? "vercel_blob" : "database" }, {
      headers: { "Cache-Control": "private, no-store, max-age=0" }
    });
  } catch (error) {
    return Response.json({ ok: false, message: error?.message || "تعذر رفع صورة رسالة واتساب." }, { status: 500 });
  }
}
