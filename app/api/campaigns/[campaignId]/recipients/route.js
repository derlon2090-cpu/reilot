import { query } from "../../../../../src/server/db.js";
import { requireSession } from "../../../../../src/server/session.js";

export async function GET(request, { params }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  const { campaignId } = await params;
  const campaign = await query(`SELECT id FROM campaigns WHERE tenant_id=$1 AND id=$2`, [auth.session.tenantId, campaignId]);
  if (!campaign.rowCount) return Response.json({ ok: false, reason: "not_found" }, { status: 404 });
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 20)));
  const status = String(url.searchParams.get("status") || "").trim();
  const values = [auth.session.tenantId, campaignId];
  const where = ["tenant_id=$1", "campaign_id=$2"];
  if (status) { values.push(status); where.push(`status=$${values.length}`); }
  values.push(limit, (page - 1) * limit);
  const result = await query(
    `SELECT id,contact_name_snapshot AS "contactName",destination_masked AS destination,channel,status,
            queued_at AS "queuedAt",sent_at AS "sentAt",delivered_at AS "deliveredAt",read_at AS "readAt",
            failed_at AS "failedAt",failure_code AS "failureCode",failure_message AS "failureMessage",
            count(*) OVER()::int AS "totalCount"
       FROM campaign_recipients WHERE ${where.join(" AND ")}
      ORDER BY created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );
  return Response.json({ ok: true, items: result.rows, page, limit, total: Number(result.rows[0]?.totalCount || 0) });
}
