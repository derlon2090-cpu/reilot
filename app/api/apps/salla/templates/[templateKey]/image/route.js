import crypto from "node:crypto";
import { del, put } from "@vercel/blob";
import { appBaseUrl } from "../../../../../../../src/server/app-url.js";
import { sameOriginRequest } from "../../../../../../../src/server/campaign-contacts.js";
import { query } from "../../../../../../../src/server/db.js";
import { getSallaAutomationTemplate } from "../../../../../../../src/server/salla-templates.js";
import { requireSession } from "../../../../../../../src/server/session.js";

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
  return `${appBaseUrl()}/api/public/salla-template-image/${encodeURIComponent(imageId)}?v=${encodeURIComponent(revision)}`;
}

function fail(error) {
  return Response.json({ ok: false, code: error.code || "SALLA_TEMPLATE_IMAGE_ERROR", message: error.message || "تعذر رفع صورة رسالة واتساب." }, { status: error.status || 500 });
}

export async function POST(request, { params }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير موثوق." }, { status: 403 });

  try {
    const { templateKey } = await params;
    const template = await getSallaAutomationTemplate({
      tenantId: auth.session.tenantId,
      userId: auth.session.userId,
      templateKey
    });
    if (!template.available || !template.item) {
      return Response.json({ ok: false, message: "اربط متجر سلة أولًا قبل رفع صورة القالب." }, { status: 409 });
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
      `SELECT id,image_url AS "imageUrl" FROM tenant_salla_template_images
        WHERE tenant_id=$1 AND template_key=$2 LIMIT 1`,
      [auth.session.tenantId, templateKey]
    );
    const imageId = current.rows[0]?.id || crypto.randomUUID();
    const revision = crypto.randomUUID();
    const useBlobStorage = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
    const blob = useBlobStorage
      ? await put(`salla-template-images/${auth.session.tenantId}/${templateKey}/${revision}.${rule.ext}`, bytes, {
          access: "public",
          addRandomSuffix: false,
          contentType: file.type
        })
      : null;
    const imageUrl = blob?.url || databaseImageUrl(imageId, revision);

    try {
      await query(
        `INSERT INTO tenant_salla_template_images (
           id,tenant_id,template_key,image_url,image_data,image_content_type,updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,now())
         ON CONFLICT (tenant_id,template_key) DO UPDATE SET
           image_url=EXCLUDED.image_url,
           image_data=EXCLUDED.image_data,
           image_content_type=EXCLUDED.image_content_type,
           updated_at=now()`,
        [imageId, auth.session.tenantId, templateKey, imageUrl, useBlobStorage ? null : bytes, useBlobStorage ? null : file.type]
      );
    } catch (error) {
      await removeManagedBlob(blob?.url);
      throw error;
    }

    if (current.rows[0]?.imageUrl !== imageUrl) await removeManagedBlob(current.rows[0]?.imageUrl);
    return Response.json({ ok: true, imageUrl, storage: useBlobStorage ? "vercel_blob" : "database" }, {
      headers: { "Cache-Control": "private, no-store, max-age=0" }
    });
  } catch (error) {
    return fail(error);
  }
}
