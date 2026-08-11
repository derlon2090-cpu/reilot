import crypto from "node:crypto";
import { put } from "@vercel/blob";
import { requireSession } from "../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../src/server/campaign-contacts.js";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const TYPES = {
  "image/png": { ext: "png", matches: (bytes) => bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 },
  "image/jpeg": { ext: "jpg", matches: (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  "image/webp": { ext: "webp", matches: (bytes) => bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP" }
};

export async function POST(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok:false, reason:"invalid_origin" }, { status:403 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json({ ok:false, reason:"campaign_asset_storage_not_configured", message:"تخزين صور الحملات غير مهيأ حاليًا." }, { status:503 });
  }
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || typeof file.arrayBuffer !== "function") return Response.json({ ok:false, reason:"file_required", message:"اختر صورة للبطاقة." }, { status:400 });
  if (!file.size || file.size > MAX_IMAGE_BYTES) return Response.json({ ok:false, reason:"file_too_large", message:"يجب ألا يتجاوز حجم الصورة 5 ميجابايت." }, { status:400 });
  const rule = TYPES[file.type];
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!rule || !rule.matches(bytes)) return Response.json({ ok:false, reason:"invalid_file_type", message:"الصيغ المدعومة هي PNG وJPG وWebP فقط." }, { status:400 });
  const blob = await put(`campaign-assets/${auth.session.tenantId}/${crypto.randomUUID()}.${rule.ext}`, bytes, {
    access:"public",
    addRandomSuffix:false,
    contentType:file.type
  });
  return Response.json({ ok:true, imageUrl:blob.url });
}
