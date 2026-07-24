import { z } from "zod";
import { query, transaction } from "../../../src/server/db.js";
import { requireSession } from "../../../src/server/session.js";
import { sameOriginRequest } from "../../../src/server/campaign-contacts.js";

const campaignSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(600).optional().nullable(),
  channel: z.enum(["whatsapp","email"]),
  subject: z.string().trim().max(200).optional().nullable(),
  body: z.string().trim().max(12000).optional().default(""),
  scheduleMode: z.enum(["manual","now","scheduled"]).optional().default("manual"),
  scheduledFor: z.coerce.date().optional().nullable(),
  audienceFilter: z.record(z.string(), z.unknown()).optional().default({})
});

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
  const [campaigns, stats, activity] = await Promise.all([
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
            WHERE tenant_id=$1 AND type LIKE 'campaign.%' ORDER BY created_at DESC LIMIT 6`, [auth.session.tenantId])
  ]);
  const summary = stats.rows[0];
  summary.deliveryRate = Number(summary.sent) > 0 ? Number(((Number(summary.delivered) / Number(summary.sent)) * 100).toFixed(1)) : 0;
  return Response.json({ ok: true, items: campaigns.rows, summary, activity: activity.rows, page, limit, total: campaigns.rows[0]?.totalCount || 0 });
}

export async function POST(request) {
  const auth = await requireSession(request); if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, reason: "invalid_origin" }, { status: 403 });
  const parsed = campaignSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ ok: false, reason: "invalid_input", issues: parsed.error.issues }, { status: 400 });
  if (parsed.data.scheduleMode === "scheduled" && (!parsed.data.scheduledFor || parsed.data.scheduledFor <= new Date())) {
    return Response.json({ ok: false, reason: "invalid_schedule", message: "اختر موعدًا مستقبليًا صالحًا." }, { status: 400 });
  }
  const item = await transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`campaign-create:${auth.session.tenantId}`]);
    const result = await client.query(
      `INSERT INTO campaigns (tenant_id,created_by,name,description,channel,subject,body,audience_filter,schedule_mode,scheduled_for)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10)
       RETURNING id,name,channel,status,schedule_mode AS "scheduleMode",scheduled_for AS "scheduledFor",created_at AS "createdAt"`,
      [auth.session.tenantId, auth.session.userId, parsed.data.name, parsed.data.description || null, parsed.data.channel,
       parsed.data.subject || null, parsed.data.body, JSON.stringify(parsed.data.audienceFilter), parsed.data.scheduleMode, parsed.data.scheduledFor || null]
    );
    await client.query(`INSERT INTO activity_logs(tenant_id,user_id,type,title,metadata) VALUES($1,$2,'campaign.created','Campaign draft created',$3::jsonb)`, [auth.session.tenantId, auth.session.userId, JSON.stringify({ campaignId: result.rows[0].id, channel: parsed.data.channel })]);
    return result.rows[0];
  });
  return Response.json({ ok: true, item }, { status: 201 });
}
