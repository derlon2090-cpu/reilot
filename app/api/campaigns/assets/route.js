import crypto from "node:crypto";
import { del, put } from "@vercel/blob";
import { appBaseUrl } from "../../../../src/server/app-url.js";
import { query } from "../../../../src/server/db.js";
import { requireSession } from "../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../src/server/campaign-contacts.js";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const TYPES = {
  "image/png": { ext: "png", matches: (bytes) => bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 },
  "image/jpeg": { ext: "jpg", matches: (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  "image/webp": { ext: "webp", matches: (bytes) => bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP" }
};

function databaseImageUrl(imageId, revision) {
  return `${appBaseUrl()}/api/public/salla-template-image/${encodeURIComponent(imageId)}?v=${encodeURIComponent(revision)}`;
}

function isManagedBlob(url) {
  return /^https:\/\/.+\.blob\.vercel-storage\.com\//i.test(String(url || ""));
}

export async function GET(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  const result = await query(
    `SELECT id,image_url AS "imageUrl",image_content_type AS "contentType",created_at AS "createdAt",updated_at AS "updatedAt"
       FROM tenant_salla_template_images
      WHERE tenant_id=$1 AND template_key LIKE 'campaign_asset\\_%' ESCAPE '\\'
      ORDER BY updated_at DESC LIMIT 100`,
    [auth.session.tenantId]
  );
  return Response.json({
    ok:true,
    assets:result.rows.map((row, index) => ({
      ...row,
      name:`صورة حملة ${index + 1}`,
      canDelete:true
    }))
  }, { headers:{ "Cache-Control":"private, no-store, max-age=0" } });
}

export async function POST(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok:false, reason:"invalid_origin" }, { status:403 });
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || typeof file.arrayBuffer !== "function") return Response.json({ ok:false, reason:"file_required", message:"اختر صورة للبطاقة." }, { status:400 });
  if (!file.size || file.size > MAX_IMAGE_BYTES) return Response.json({ ok:false, reason:"file_too_large", message:"يجب ألا يتجاوز حجم الصورة 5 ميجابايت." }, { status:400 });
  const rule = TYPES[file.type];
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!rule || !rule.matches(bytes)) return Response.json({ ok:false, reason:"invalid_file_type", message:"الصيغ المدعومة هي PNG وJPG وWebP فقط." }, { status:400 });

  const imageId = crypto.randomUUID();
  const revision = crypto.randomUUID();
  const useBlobStorage = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  let imageUrl;
  if (useBlobStorage) {
    const blob = await put(`campaign-assets/${auth.session.tenantId}/${revision}.${rule.ext}`, bytes, {
      access:"public",
      addRandomSuffix:false,
      contentType:file.type
    });
    imageUrl = blob.url;
  } else {
    imageUrl = databaseImageUrl(imageId, revision);
  }

  try {
    await query(
      `INSERT INTO tenant_salla_template_images
         (id,tenant_id,template_key,image_url,image_data,image_content_type,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,now())`,
      [imageId, auth.session.tenantId, `campaign_asset_${imageId}`, imageUrl, useBlobStorage ? null : bytes, useBlobStorage ? null : file.type]
    );
  } catch (error) {
    if (useBlobStorage) await del(imageUrl).catch(() => null);
    throw error;
  }
  return Response.json({ ok:true, imageId, imageUrl, storage:useBlobStorage ? "vercel_blob" : "database" }, {
    headers: { "Cache-Control":"private, no-store, max-age=0" }
  });
}

export async function DELETE(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok:false, reason:"invalid_origin" }, { status:403 });
  const imageId = new URL(request.url).searchParams.get("imageId") || "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(imageId)) {
    return Response.json({ ok:false, reason:"invalid_image_id", message:"الصورة غير صالحة." }, { status:400 });
  }
  const deleted = await query(
    `DELETE FROM tenant_salla_template_images
      WHERE id=$1 AND tenant_id=$2 AND template_key LIKE 'campaign_asset\\_%' ESCAPE '\\'
      RETURNING image_url AS "imageUrl"`,
    [imageId, auth.session.tenantId]
  );
  if (!deleted.rows[0]) return Response.json({ ok:false, reason:"not_found", message:"الصورة غير موجودة." }, { status:404 });
  if (isManagedBlob(deleted.rows[0].imageUrl)) await del(deleted.rows[0].imageUrl).catch(() => null);
  return Response.json({ ok:true, imageId }, { headers:{ "Cache-Control":"private, no-store, max-age=0" } });
}
