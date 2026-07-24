import { destinationHash, maskDestination } from "./campaign-contacts.js";
import { reserveMessageQuotaWithClient } from "../lib/billing/message-quota.js";

export async function lockTenantCampaign(client, tenantId, campaignId) {
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`campaign:${tenantId}:${campaignId}`]);
  const result = await client.query(`SELECT * FROM campaigns WHERE tenant_id=$1 AND id=$2 FOR UPDATE`, [tenantId, campaignId]);
  return result.rows[0] || null;
}

export async function estimateCampaignAudience(client, campaign) {
  const channel = campaign.channel;
  const result = await client.query(
    `SELECT c.id AS contact_id, c.display_name, cp.id AS contact_point_id, cp.normalized_value
       FROM contacts c
       JOIN LATERAL (
         SELECT p.id,p.normalized_value FROM contact_points p
          WHERE p.tenant_id=c.tenant_id AND p.contact_id=c.id
            AND p.channel=$2 AND p.status='active' AND p.consent_status <> 'revoked'
          ORDER BY p.is_primary DESC,p.created_at LIMIT 1
       ) cp ON true
      WHERE c.tenant_id=$1 AND c.status='active'
      ORDER BY c.created_at`,
    [campaign.tenant_id, channel]
  );
  const total = await client.query(`SELECT count(*)::int AS total FROM contacts WHERE tenant_id=$1 AND status='active'`, [campaign.tenant_id]);
  return { total: Number(total.rows[0]?.total || 0), eligible: result.rowCount, recipients: result.rows };
}

export async function prepareCampaign(client, campaign) {
  const estimate = await estimateCampaignAudience(client, campaign);
  await client.query(`DELETE FROM campaign_recipients WHERE tenant_id=$1 AND campaign_id=$2 AND status='prepared'`, [campaign.tenant_id,campaign.id]);
  for (const recipient of estimate.recipients) {
    const hash = destinationHash(recipient.normalized_value);
    await client.query(
      `INSERT INTO campaign_recipients
         (tenant_id,campaign_id,contact_id,contact_point_id,contact_name_snapshot,destination_masked,destination_hash,channel,idempotency_key)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (campaign_id,contact_point_id) DO NOTHING`,
      [campaign.tenant_id,campaign.id,recipient.contact_id,recipient.contact_point_id,recipient.display_name,
       maskDestination(recipient.normalized_value,campaign.channel),hash,campaign.channel,`campaign:${campaign.id}:destination:${hash}`]
    );
  }
  await client.query(
    `UPDATE campaigns SET status='ready',total_recipients=$3,eligible_recipients=$4,updated_at=now() WHERE tenant_id=$1 AND id=$2`,
    [campaign.tenant_id,campaign.id,estimate.total,estimate.eligible]
  );
  return estimate;
}

export async function queuePreparedCampaign(client, campaign) {
  const prepared = await client.query(
    `SELECT id FROM campaign_recipients WHERE tenant_id=$1 AND campaign_id=$2 AND status='prepared' FOR UPDATE`,
    [campaign.tenant_id,campaign.id]
  );
  if (!prepared.rowCount) throw Object.assign(new Error("لا توجد جهات اتصال مؤهلة للإرسال."), { code: "empty_audience" });
  const quota = await reserveMessageQuotaWithClient(client, { tenantId: campaign.tenant_id, channelType: campaign.channel, quantity: prepared.rowCount });
  await client.query(
    `UPDATE campaign_recipients SET status='queued',queued_at=now(),updated_at=now()
      WHERE tenant_id=$1 AND campaign_id=$2 AND status='prepared'`, [campaign.tenant_id,campaign.id]
  );
  await client.query(
    `INSERT INTO campaign_credit_entries(tenant_id,campaign_id,entry_type,amount,idempotency_key)
     VALUES($1,$2,'reserve',$3,$4) ON CONFLICT (tenant_id,idempotency_key) DO NOTHING`,
    [campaign.tenant_id,campaign.id,prepared.rowCount,`campaign:${campaign.id}:reserve`]
  );
  await client.query(
    `UPDATE campaigns SET status='queueing',queued_count=$3,reserved_credits=$3,quota_period_id=$4,
            started_at=COALESCE(started_at,now()),updated_at=now()
      WHERE tenant_id=$1 AND id=$2`, [campaign.tenant_id,campaign.id,prepared.rowCount,quota.periodId]
  );
  return { queued: prepared.rowCount, usage: quota.usage };
}
