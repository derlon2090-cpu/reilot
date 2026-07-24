import { transaction } from "../../../../../src/server/db.js";
import { requireSession } from "../../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../../src/server/campaign-contacts.js";
import { releaseReservedQuotaWithClient } from "../../../../../src/lib/billing/message-quota.js";

export async function POST(request, { params }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, reason: "invalid_origin" }, { status: 403 });
  const { campaignId } = await params;
  const changed = await transaction(async (client) => {
    const result = await client.query(
      `SELECT * FROM campaigns WHERE tenant_id=$1 AND id=$2 FOR UPDATE`,
      [auth.session.tenantId, campaignId]
    );
    const campaign = result.rows[0];
    if (!campaign || ["completed", "cancelled"].includes(campaign.status)) return false;
    if (campaign.quota_period_id && Number(campaign.reserved_credits) > 0) {
      await releaseReservedQuotaWithClient(client, {
        periodId: campaign.quota_period_id,
        quantity: Number(campaign.reserved_credits)
      });
      await client.query(
        `INSERT INTO campaign_credit_entries(tenant_id,campaign_id,entry_type,amount,idempotency_key)
         VALUES($1,$2,'release',$3,$4) ON CONFLICT DO NOTHING`,
        [auth.session.tenantId, campaignId, Number(campaign.reserved_credits), `campaign:${campaignId}:cancel-release`]
      );
    }
    await client.query(
      `UPDATE campaign_recipients SET status='cancelled',updated_at=now()
        WHERE tenant_id=$1 AND campaign_id=$2 AND status IN ('prepared','queued')`,
      [auth.session.tenantId, campaignId]
    );
    await client.query(
      `UPDATE campaigns SET status='cancelled',queued_count=0,reserved_credits=0,quota_period_id=NULL,updated_at=now()
        WHERE tenant_id=$1 AND id=$2`,
      [auth.session.tenantId, campaignId]
    );
    await client.query(
      `INSERT INTO activity_logs(tenant_id,user_id,type,title,metadata)
       VALUES($1,$2,'campaign.cancelled','Campaign cancelled',$3::jsonb)`,
      [auth.session.tenantId, auth.session.userId, JSON.stringify({ campaignId })]
    );
    return true;
  });
  return changed
    ? Response.json({ ok: true, status: "cancelled" })
    : Response.json({ ok: false, reason: "invalid_status" }, { status: 409 });
}
