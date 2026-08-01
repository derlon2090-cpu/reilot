import { query, transaction } from "../../../src/server/db.js";
import { requireSession } from "../../../src/server/session.js";
import { sameOriginRequest } from "../../../src/server/campaign-contacts.js";
import { assertCampaignChannelReady, prepareCampaign } from "../../../src/server/campaign-actions.js";
import { campaignAudienceFilter, campaignCreateSchema } from "../../../src/server/campaign-config.js";
import { assertPlanFeature, planEntitlementResponse } from "../../../src/server/plan-entitlements.js";

export async function GET(request) {
  const auth = await requireSession(request); if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const status = String(url.searchParams.get("status") || "");
  const channel = String(url.searchParams.get("channel") || "");
  const search = String(url.searchParams.get("search") || "").trim();
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 20)));
  const values = [auth.session.tenantId];
  const where = ["tenant_id=$1"];
  if (["draft","validating","ready","scheduled","queueing","sending","paused","completed","cancelled","failed"].includes(status)) { values.push(status); where.push(`status=$${values.length}`); }
  if (["whatsapp","email"].includes(channel)) { values.push(channel); where.push(`channel=$${values.length}`); }
  if (search) { values.push(`%${search.toLowerCase()}%`); where.push(`lower(name) LIKE $${values.length}`); }
  values.push(limit, (page - 1) * limit);
  const [campaigns, stats, activity, channels, groups, templates, metaTemplates] = await Promise.all([
    query(`SELECT id,name,description,channel,status,subject,schedule_mode AS "scheduleMode",scheduled_for AS "scheduledFor",
                  total_recipients AS "totalRecipients",eligible_recipients AS "eligibleRecipients",queued_count AS "queuedCount",
                  sent_count AS "sentCount",delivered_count AS "deliveredCount",read_count AS "readCount",failed_count AS "failedCount",
                  skipped_count AS "skippedCount",charged_credits AS "chargedCredits",created_at AS "createdAt",updated_at AS "updatedAt",
                  count(*) OVER()::int AS "totalCount"
             FROM campaigns WHERE ${where.join(" AND ")} ORDER BY created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`, values),
    query(`SELECT count(*)::int AS total,
                  count(*) FILTER (WHERE status IN ('scheduled','queueing','sending'))::int AS active,
                  COALESCE(sum(sent_count) FILTER (WHERE created_at >= date_trunc('month',now())),0)::int AS "messagesThisMonth",
                  COALESCE(sum(delivered_count),0)::int AS delivered,
                  COALESCE(sum(sent_count),0)::int AS sent,
                  COALESCE(sum(failed_count),0)::int AS failed
             FROM campaigns WHERE tenant_id=$1`, [auth.session.tenantId]),
    query(`SELECT title,type,metadata,created_at AS "createdAt" FROM activity_logs
            WHERE tenant_id=$1 AND type LIKE 'campaign.%' ORDER BY created_at DESC LIMIT 6`, [auth.session.tenantId]),
    query(`SELECT id,provider,status,phone_number AS "phoneNumber",
                  COALESCE(NULLIF(display_name,''),NULLIF(device_name,''),NULLIF(phone_number,''),'جهاز واتساب') AS name
             FROM whatsapp_channels WHERE tenant_id=$1 AND provider IN ('meta','meta_cloud_api')
            ORDER BY CASE status WHEN 'connected' THEN 0 ELSE 1 END,updated_at DESC`, [auth.session.tenantId]),
    query(`SELECT ct.id,ct.name,ct.color,count(cta.contact_id)::int AS "contactsCount"
             FROM contact_tags ct LEFT JOIN contact_tag_assignments cta ON cta.tag_id=ct.id AND cta.tenant_id=ct.tenant_id
            WHERE ct.tenant_id=$1 GROUP BY ct.id ORDER BY lower(ct.name)`, [auth.session.tenantId]),
    query(`SELECT id,name,channel,title AS subject,body FROM notification_templates
            WHERE tenant_id=$1 AND is_active=true ORDER BY updated_at DESC`, [auth.session.tenantId]),
    query(`SELECT mt.id,mt.display_name AS name,mt.language,mt.components,mt.meta_integration_id AS "channelId"
             FROM meta_message_templates mt
            WHERE mt.tenant_id=$1 AND mt.deleted_at IS NULL
              AND (mt.local_status='approved' OR upper(COALESCE(mt.meta_status,''))='APPROVED')
            ORDER BY mt.updated_at DESC`, [auth.session.tenantId])
  ]);
  const summary = stats.rows[0];
  summary.deliveryRate = Number(summary.sent) > 0 ? Number(((Number(summary.delivered) / Number(summary.sent)) * 100).toFixed(1)) : 0;
  return Response.json({
    ok: true,
    items: campaigns.rows,
    summary,
    activity: activity.rows,
    createOptions: {
      devices: channels.rows,
      groups: groups.rows,
      templates: templates.rows,
      metaTemplates: metaTemplates.rows
    },
    page,
    limit,
    total: campaigns.rows[0]?.totalCount || 0
  });
}

export async function POST(request) {
  const auth = await requireSession(request); if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, reason: "invalid_origin" }, { status: 403 });
  try { await assertPlanFeature(auth.session.tenantId, "campaignsEnabled"); }
  catch (error) { const response = planEntitlementResponse(error); if (response) return response; throw error; }
  const parsed = campaignCreateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ ok: false, reason: "invalid_input", message: parsed.error.issues[0]?.message, issues: parsed.error.issues }, { status: 400 });
  try {
    const item = await transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`campaign-create:${auth.session.tenantId}`]);
    if (parsed.data.whatsappChannelId) {
      const owned = await client.query("SELECT id,status FROM whatsapp_channels WHERE tenant_id=$1 AND id=$2", [auth.session.tenantId, parsed.data.whatsappChannelId]);
      if (!owned.rows[0] || owned.rows[0].status !== "connected") throw Object.assign(new Error("اختر جهاز واتساب متصلًا بحسابك."), { code: "invalid_device" });
    }
    if (parsed.data.groupId) {
      const owned = await client.query("SELECT id FROM contact_tags WHERE tenant_id=$1 AND id=$2", [auth.session.tenantId, parsed.data.groupId]);
      if (!owned.rows[0]) throw Object.assign(new Error("مجموعة جهات الاتصال المحددة غير متاحة."), { code: "invalid_group" });
    }
    if (parsed.data.templateId) {
      const owned = await client.query("SELECT id,channel FROM notification_templates WHERE tenant_id=$1 AND id=$2 AND is_active=true", [auth.session.tenantId, parsed.data.templateId]);
      if (!owned.rows[0] || owned.rows[0].channel !== parsed.data.channel) throw Object.assign(new Error("القالب المحدد لا يطابق قناة الإرسال."), { code: "invalid_template" });
    }
    if (parsed.data.metaTemplateId) {
      const owned = await client.query(`SELECT id,meta_integration_id FROM meta_message_templates
        WHERE tenant_id=$1 AND id=$2 AND deleted_at IS NULL
          AND (local_status='approved' OR upper(COALESCE(meta_status,''))='APPROVED')`, [auth.session.tenantId, parsed.data.metaTemplateId]);
      if (!owned.rows[0] || owned.rows[0].meta_integration_id !== parsed.data.whatsappChannelId) {
        throw Object.assign(new Error("اختر قالب Meta معتمدًا على الجهاز المحدد."), { code: "invalid_meta_template" });
      }
    }
    const audienceFilter = campaignAudienceFilter(parsed.data);
    const result = await client.query(
      `INSERT INTO campaigns (
         tenant_id,created_by,name,description,channel,whatsapp_channel_id,template_id,meta_template_id,
         subject,body,audience_filter,schedule_mode,scheduled_for,is_enabled,timezone,send_window_end,
         allowed_days,min_delay_seconds,max_delay_seconds
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15,$16,$17::smallint[],$18,$19)
       RETURNING *`,
      [auth.session.tenantId, auth.session.userId, parsed.data.name, parsed.data.description || null, parsed.data.channel,
       parsed.data.whatsappChannelId || null, parsed.data.templateId || null, parsed.data.metaTemplateId || null,
       parsed.data.subject || null, parsed.data.body, JSON.stringify(audienceFilter), parsed.data.isEnabled ? "scheduled" : "manual",
       parsed.data.scheduledFor, parsed.data.isEnabled, parsed.data.timezone, parsed.data.endTime,
       parsed.data.allowedDays, parsed.data.minDelaySeconds, parsed.data.maxDelaySeconds]
    );
    if (parsed.data.isEnabled) {
      await assertCampaignChannelReady(client, result.rows[0]);
      const estimate = await prepareCampaign(client, result.rows[0]);
      if (!estimate.eligible) throw Object.assign(new Error("لا توجد جهات اتصال مؤهلة في المجموعة المحددة."), { code: "empty_audience" });
      await client.query("UPDATE campaigns SET status='scheduled',updated_at=now() WHERE id=$1", [result.rows[0].id]);
      result.rows[0].status = "scheduled";
      result.rows[0].eligible_recipients = estimate.eligible;
    }
    await client.query(`INSERT INTO activity_logs(tenant_id,user_id,type,title,metadata) VALUES($1,$2,'campaign.created','Campaign draft created',$3::jsonb)`, [auth.session.tenantId, auth.session.userId, JSON.stringify({ campaignId: result.rows[0].id, channel: parsed.data.channel })]);
    return result.rows[0];
    });
    return Response.json({ ok: true, item }, { status: 201 });
  } catch (error) {
    return Response.json({ ok: false, reason: error.code || "campaign_create_failed", message: error.message || "تعذر إنشاء الحملة." }, { status: 409 });
  }
}
