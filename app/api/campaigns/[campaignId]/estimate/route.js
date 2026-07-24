import { transaction } from "../../../../../src/server/db.js";
import { requireSession } from "../../../../../src/server/session.js";
import { estimateCampaignAudience, lockTenantCampaign } from "../../../../../src/server/campaign-actions.js";

export async function GET(request,{params}) {
  const auth=await requireSession(request); if(!auth.ok) return auth.response;
  const {campaignId}=await params;
  const estimate=await transaction(async client=>{ const campaign=await lockTenantCampaign(client,auth.session.tenantId,campaignId); if(!campaign) return null; return estimateCampaignAudience(client,campaign); });
  return estimate ? Response.json({ok:true,estimate:{total:estimate.total,eligible:estimate.eligible,excluded:Math.max(0,estimate.total-estimate.eligible)}}) : Response.json({ok:false,reason:'not_found'},{status:404});
}
