import { z } from "zod";
import { query } from "../../../../src/server/db.js";
import { requireSession } from "../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../src/server/campaign-contacts.js";

const schema = z.object({
  name: z.string().trim().min(2).max(160).optional(), description: z.string().trim().max(600).nullable().optional(),
  subject: z.string().trim().max(200).nullable().optional(), body: z.string().trim().max(12000).optional(),
  audienceFilter: z.record(z.string(), z.unknown()).optional()
});

export async function GET(request, { params }) {
  const auth = await requireSession(request); if (!auth.ok) return auth.response;
  const { campaignId } = await params;
  const result = await query(`SELECT *, audience_filter AS "audienceFilter" FROM campaigns WHERE tenant_id=$1 AND id=$2`, [auth.session.tenantId, campaignId]);
  if (!result.rowCount) return Response.json({ ok: false, reason: "not_found" }, { status: 404 });
  return Response.json({ ok: true, item: result.rows[0] });
}

export async function PATCH(request, { params }) {
  const auth = await requireSession(request); if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, reason: "invalid_origin" }, { status: 403 });
  const { campaignId } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ ok: false, reason: "invalid_input" }, { status: 400 });
  const current = await query(`SELECT * FROM campaigns WHERE tenant_id=$1 AND id=$2`, [auth.session.tenantId, campaignId]);
  if (!current.rowCount) return Response.json({ ok: false, reason: "not_found" }, { status: 404 });
  if (!['draft','ready','paused'].includes(current.rows[0].status)) return Response.json({ ok:false, reason:'campaign_locked', message:'لا يمكن تعديل الحملة أثناء الإرسال.' }, { status:409 });
  const data = parsed.data;
  const result = await query(
    `UPDATE campaigns SET name=$3,description=$4,subject=$5,body=$6,audience_filter=$7::jsonb,status='draft',updated_at=now()
      WHERE tenant_id=$1 AND id=$2 RETURNING id,name,channel,status,updated_at AS "updatedAt"`,
    [auth.session.tenantId,campaignId,data.name ?? current.rows[0].name,data.description === undefined ? current.rows[0].description : data.description,
     data.subject === undefined ? current.rows[0].subject : data.subject,data.body ?? current.rows[0].body,
     JSON.stringify(data.audienceFilter ?? current.rows[0].audience_filter)]
  );
  await query(`INSERT INTO activity_logs(tenant_id,user_id,type,title,metadata) VALUES($1,$2,'campaign.updated','Campaign updated',$3::jsonb)`, [auth.session.tenantId,auth.session.userId,JSON.stringify({campaignId})]);
  return Response.json({ok:true,item:result.rows[0]});
}
