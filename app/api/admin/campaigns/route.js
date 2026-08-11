import { auditAdmin, requireAdminPermission } from "../../../../src/server/admin-auth.js";
import { createAdminCampaign, listAdminCampaigns, runAdminCampaignWorker } from "../../../../src/server/admin-campaigns.js";
import { sameOriginRequest } from "../../../../src/server/platform-notifications.js";
import { safeErrorMessage } from "../../../../src/server/security.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const auth = await requireAdminPermission(request, "campaigns", "read");
  if (!auth.ok) return auth.response;
  try {
    return Response.json({ ok: true, ...(await listAdminCampaigns()) }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    return Response.json({ ok: false, reason: "admin_campaigns_load_failed", message: safeErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(request) {
  if (!sameOriginRequest(request)) return Response.json({ ok: false, reason: "invalid_origin" }, { status: 403 });
  const auth = await requireAdminPermission(request, "campaigns", "create");
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => ({}));
  try {
    const campaign = await createAdminCampaign(body, auth.admin.adminId);
    await auditAdmin(request, {
      admin: auth.admin,
      action: "admin.campaign.created",
      resource: campaign.id,
      metadata: { channel: campaign.channel, recipients: campaign.totalRecipients, scheduledFor: campaign.scheduledFor }
    });
    const dueNow = new Date(campaign.scheduledFor).getTime() <= Date.now() + 1000;
    const delivery = dueNow ? await runAdminCampaignWorker({ campaignId: campaign.id, limit: 20 }) : { claimed: 0, sent: 0, failed: 0 };
    return Response.json({ ok: true, campaign, delivery }, { status: 201 });
  } catch (error) {
    await auditAdmin(request, { admin: auth.admin, action: "admin.campaign.created", resource: "admin_campaigns", status: "failed", metadata: { reason: error?.code || "create_failed" } });
    const validation = ["invalid_name", "invalid_body", "invalid_subject", "invalid_recipients", "recipients_required", "recipients_limit", "invalid_schedule", "schedule_too_far"].includes(error?.code);
    return Response.json({ ok: false, reason: error?.code || "admin_campaign_create_failed", message: error?.message || safeErrorMessage(error) }, { status: validation ? 400 : 500 });
  }
}
