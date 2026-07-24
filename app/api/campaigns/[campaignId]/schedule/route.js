import { z } from "zod";
import { transaction } from "../../../../../src/server/db.js";
import { requireSession } from "../../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../../src/server/campaign-contacts.js";
import { lockTenantCampaign, prepareCampaign } from "../../../../../src/server/campaign-actions.js";

const schema = z.object({ scheduledFor: z.string().datetime({ offset: true }) });

export async function POST(request, { params }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, reason: "invalid_origin" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ ok: false, reason: "invalid_input" }, { status: 400 });
  const scheduledFor = new Date(parsed.data.scheduledFor);
  if (scheduledFor.getTime() < Date.now() + 60_000) {
    return Response.json({ ok: false, reason: "invalid_schedule", message: "اختر موعدًا بعد دقيقة واحدة على الأقل." }, { status: 400 });
  }
  const { campaignId } = await params;
  try {
    const result = await transaction(async (client) => {
      const campaign = await lockTenantCampaign(client, auth.session.tenantId, campaignId);
      if (!campaign) return null;
      if (!["draft", "ready", "paused"].includes(campaign.status)) {
        throw Object.assign(new Error("لا يمكن جدولة الحملة في حالتها الحالية."), { code: "invalid_status" });
      }
      const estimate = await prepareCampaign(client, campaign);
      if (!estimate.eligible) throw Object.assign(new Error("لا توجد جهات اتصال مؤهلة للإرسال."), { code: "empty_audience" });
      await client.query(
        `UPDATE campaigns SET status='scheduled',schedule_mode='scheduled',scheduled_for=$3,updated_at=now()
          WHERE tenant_id=$1 AND id=$2`,
        [auth.session.tenantId, campaignId, scheduledFor]
      );
      await client.query(
        `INSERT INTO activity_logs(tenant_id,user_id,type,title,metadata)
         VALUES($1,$2,'campaign.scheduled','Campaign scheduled',$3::jsonb)`,
        [auth.session.tenantId, auth.session.userId, JSON.stringify({ campaignId, scheduledFor: scheduledFor.toISOString(), eligible: estimate.eligible })]
      );
      return estimate;
    });
    return result
      ? Response.json({ ok: true, status: "scheduled", scheduledFor: scheduledFor.toISOString(), estimate: result })
      : Response.json({ ok: false, reason: "not_found" }, { status: 404 });
  } catch (error) {
    return Response.json({ ok: false, reason: error.code || "schedule_failed", message: error.message }, { status: 409 });
  }
}
