import crypto from "node:crypto";
import { del } from "@vercel/blob";
import { appBaseUrl } from "../../../../../../../../src/server/app-url.js";
import { sameOriginRequest } from "../../../../../../../../src/server/campaign-contacts.js";
import { query } from "../../../../../../../../src/server/db.js";
import { getSallaAutomationTemplate } from "../../../../../../../../src/server/salla-templates.js";
import { requireSession } from "../../../../../../../../src/server/session.js";

function imageUrl(imageId, revision) {
  return `${appBaseUrl()}/api/public/salla-template-image/${encodeURIComponent(imageId)}?v=${encodeURIComponent(revision)}`;
}

export async function POST(request, { params }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير موثوق." }, { status: 403 });
  try {
    const { templateKey } = await params;
    const body = await request.json().catch(() => ({}));
    const assetId = String(body.assetId || "");
    const template = await getSallaAutomationTemplate({ tenantId: auth.session.tenantId, userId: auth.session.userId, templateKey });
    if (!template.available || !template.item) return Response.json({ ok: false, message: "اربط متجر سلة أولًا قبل اختيار صورة القالب." }, { status: 409 });
    const asset = await query(
      `SELECT id FROM storage_assets WHERE id=$1 AND tenant_id=$2 AND status='ready' AND deleted_at IS NULL LIMIT 1`,
      [assetId, auth.session.tenantId]
    );
    if (!asset.rows[0]) return Response.json({ ok: false, message: "الصورة المحفوظة غير متاحة." }, { status: 404 });
    const current = await query(
      `SELECT id,image_url AS "imageUrl" FROM tenant_salla_template_images WHERE tenant_id=$1 AND template_key=$2 LIMIT 1`,
      [auth.session.tenantId, templateKey]
    );
    const id = current.rows[0]?.id || crypto.randomUUID();
    const url = imageUrl(id, crypto.randomUUID());
    await query(
      `INSERT INTO tenant_salla_template_images(id,tenant_id,template_key,image_url,image_data,image_content_type,storage_asset_id,updated_at)
       VALUES($1,$2,$3,$4,NULL,NULL,$5,now())
       ON CONFLICT(tenant_id,template_key) DO UPDATE SET image_url=EXCLUDED.image_url,image_data=NULL,image_content_type=NULL,
         storage_asset_id=EXCLUDED.storage_asset_id,updated_at=now()`,
      [id, auth.session.tenantId, templateKey, url, assetId]
    );
    if (/^https:\/\/.+\.blob\.vercel-storage\.com\//i.test(current.rows[0]?.imageUrl || "")) await del(current.rows[0].imageUrl).catch(() => null);
    return Response.json({ ok: true, imageUrl: url, storageAssetId: assetId }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ ok: false, code: error?.code || "SALLA_STORAGE_IMAGE_ERROR", message: error?.message || "تعذر اختيار الصورة المحفوظة." }, { status: Number(error?.status || 500) });
  }
}
