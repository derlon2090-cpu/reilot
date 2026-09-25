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

async function removeManagedBlob(url) {
  if (!url || !/^https:\/\/.+\.blob\.vercel-storage\.com\//i.test(url)) return;
  await del(url).catch(() => null);
}

function databaseImageUrl(imageId, revision) {
  return `${appBaseUrl()}/api/public/campaign-image/${encodeURIComponent(imageId)}?v=${encodeURIComponent(revision)}`;
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
  const blob = useBlobStorage
    ? await put(`campaign-assets/${auth.session.tenantId}/${revision}.${rule.ext}`, bytes, {
        access:"public",
        addRandomSuffix:false,
        contentType:file.type
      })
    : null;
  const imageUrl = blob?.url || databaseImageUrl(imageId, revision);

  try {
    await query(
      `INSERT INTO tenant_campaign_assets
         (id,tenant_id,image_url,image_data,image_content_type,original_name,size_bytes,created_by_user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        imageId,
        auth.session.tenantId,
        imageUrl,
        useBlobStorage ? null : bytes,
        useBlobStorage ? null : file.type,
        String(file.name || `campaign-image.${rule.ext}`).slice(0, 180),
        bytes.length,
        auth.session.userId
      ]
    );
  } catch (error) {
    await removeManagedBlob(blob?.url);
    throw error;
  }

  return Response.json({ ok:true, imageUrl, storage:useBlobStorage ? "vercel_blob" : "database" }, {
    headers: { "Cache-Control":"private, no-store, max-age=0" }
  });
}
