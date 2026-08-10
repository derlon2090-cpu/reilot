import { transaction } from "../../../../../src/server/db.js";
import { requireSession } from "../../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../../src/server/campaign-contacts.js";

export async function POST(request, { params }) {
  const auth = await requireSession(request); if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, reason: "invalid_origin" }, { status: 403 });
  const { campaignId } = await params;
  const item = await transaction(async (client) => {
    const source = await client.query(`SELECT * FROM campaigns WHERE tenant_id=$1 AND id=$2`, [auth.session.tenantId, campaignId]);
    if (!source.rowCount) return null;
    const row = source.rows[0];
    const duplicated = await client.query(
      `INSERT INTO campaigns (tenant_id,created_by,name,description,channel,whatsapp_channel_id,template_id,meta_template_id,subject,body,audience_filter,schedule_mode,scheduled_for,is_enabled,timezone,send_window_end,allowed_days,min_delay_seconds,max_delay_seconds,status)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'manual',NULL,false,$12,$13,$14,$15,$16,'draft')
       RETURNING id,name,channel,status,created_at AS "createdAt"`,
      [auth.session.tenantId, auth.session.userId, `${row.name} — نسخة`, row.description, row.channel, row.whatsapp_channel_id, row.template_id, row.meta_template_id, row.subject, row.body, row.audience_filter, row.timezone, row.send_window_end, row.allowed_days, row.min_delay_seconds, row.max_delay_seconds]
    );
    await client.query(`INSERT INTO activity_logs(tenant_id,user_id,type,title,metadata) VALUES($1,$2,'campaign.duplicated','Campaign duplicated',$3::jsonb)`, [auth.session.tenantId, auth.session.userId, JSON.stringify({ sourceCampaignId: campaignId, campaignId: duplicated.rows[0].id })]);
    return duplicated.rows[0];
  });
  return item ? Response.json({ ok: true, item }, { status: 201 }) : Response.json({ ok: false, reason: "not_found" }, { status: 404 });
}
