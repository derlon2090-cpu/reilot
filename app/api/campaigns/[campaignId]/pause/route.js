import { transaction } from "../../../../../src/server/db.js";
import { requireSession } from "../../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../../src/server/campaign-contacts.js";
import { releaseReservedQuotaWithClient } from "../../../../../src/lib/billing/message-quota.js";

export async function POST(request, { params }) {
  const auth = await requireSession(request); if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, reason: "invalid_origin" }, { status: 403 });
  const { campaignId } = await params;
  const changed = await transaction(async (client) => {
    const locked = await client.query(`SELECT * FROM campaigns WHERE tenant_id=$1 AND id=$2 FOR UPDATE`, [auth.session.tenantId, campaignId]);
    const campaign = locked.rows[0];
    if (!campaign || !["scheduled","queueing","sending"].includes(campaign.status)) return false;
    if (campaign.quota_period_id && campaign.reserved_credits > 0) {
      await releaseReservedQuotaWithClient(client, { periodId: campaign.quota_period_id, quantity: campaign.reserved_credits });
      await client.query(
        `INSERT INTO campaign_credit_entries(tenant_id,campaign_id,entry_type,amount,idempotency_key)
         VALUES($1,$2,'release',$3,$4) ON CONFLICT DO NOTHING`,
        [auth.session.tenantId, campaignId, campaign.reserved_credits, `campaign:${campaignId}:pause-release`]
      );
    }
    await client.query(`UPDATE campaigns SET status='paused',queued_count=0,reserved_credits=0,quota_period_id=NULL,updated_at=now() WHERE tenant_id=$1 AND id=$2`, [auth.session.tenantId,campaignId]);
    await client.query(`UPDATE campaign_recipients SET status='prepared',queued_at=NULL,updated_at=now() WHERE tenant_id=$1 AND campaign_id=$2 AND status='queued'`, [auth.session.tenantId,campaignId]);
    return true;
  });
  return changed ? Response.json({ ok:true,status:"paused" }) : Response.json({ ok:false,reason:"invalid_status" }, { status:409 });
}
