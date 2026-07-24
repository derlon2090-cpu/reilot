import { query } from "../../../../../src/server/db.js";
import { requireSession } from "../../../../../src/server/session.js";
import { campaignDeliveryRate } from "../../../../../src/server/campaign-contacts.js";

export async function GET(request, { params }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  const { campaignId } = await params;
  const result = await query(
    `SELECT id,status,total_recipients AS "totalRecipients",eligible_recipients AS "eligibleRecipients",
            queued_count AS "queuedCount",sent_count AS "sentCount",delivered_count AS "deliveredCount",
            read_count AS "readCount",failed_count AS "failedCount",skipped_count AS "skippedCount",
            reserved_credits AS "reservedCredits",charged_credits AS "chargedCredits"
       FROM campaigns WHERE tenant_id=$1 AND id=$2`,
    [auth.session.tenantId, campaignId]
  );
  if (!result.rowCount) return Response.json({ ok: false, reason: "not_found" }, { status: 404 });
  const statistics = result.rows[0];
  return Response.json({ ok: true, statistics: { ...statistics, deliveryRate: campaignDeliveryRate(statistics) } });
}
