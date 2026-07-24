import { transaction } from "../../../../../src/server/db.js";
import { requireSession } from "../../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../../src/server/campaign-contacts.js";
import { lockTenantCampaign, prepareCampaign } from "../../../../../src/server/campaign-actions.js";

export async function POST(request,{params}) {
  const auth=await requireSession(request); if(!auth.ok) return auth.response;
  if(!sameOriginRequest(request)) return Response.json({ok:false,reason:'invalid_origin'},{status:403});
  const {campaignId}=await params;
  const estimate=await transaction(async client=>{const campaign=await lockTenantCampaign(client,auth.session.tenantId,campaignId);if(!campaign) return null;if(!['draft','ready'].includes(campaign.status)) throw Object.assign(new Error('الحملة غير قابلة للتحضير في حالتها الحالية.'),{code:'invalid_status'});const result=await prepareCampaign(client,campaign);await client.query(`INSERT INTO activity_logs(tenant_id,user_id,type,title,metadata) VALUES($1,$2,'campaign.prepared','Campaign recipients prepared',$3::jsonb)`,[auth.session.tenantId,auth.session.userId,JSON.stringify({campaignId,eligible:result.eligible})]);return result;});
  return estimate ? Response.json({ok:true,estimate:{total:estimate.total,eligible:estimate.eligible,excluded:Math.max(0,estimate.total-estimate.eligible)}}) : Response.json({ok:false,reason:'not_found'},{status:404});
}
