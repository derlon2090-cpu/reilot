import { transaction } from "../../../../../src/server/db.js";
import { requireSession } from "../../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../../src/server/campaign-contacts.js";
import { assertCampaignChannelReady, lockTenantCampaign, prepareCampaign, queuePreparedCampaign } from "../../../../../src/server/campaign-actions.js";

export async function POST(request,{params}) {
  const auth=await requireSession(request); if(!auth.ok) return auth.response;
  if(!sameOriginRequest(request)) return Response.json({ok:false,reason:'invalid_origin'},{status:403});
  const {campaignId}=await params;
  try { const result=await transaction(async client=>{const campaign=await lockTenantCampaign(client,auth.session.tenantId,campaignId);if(!campaign) return null;if(!['draft','ready','paused'].includes(campaign.status)) throw Object.assign(new Error('لا يمكن بدء الحملة في حالتها الحالية.'),{code:'invalid_status'});await assertCampaignChannelReady(client,campaign);if(campaign.status==='draft') await prepareCampaign(client,campaign);const queued=await queuePreparedCampaign(client,campaign);await client.query(`INSERT INTO activity_logs(tenant_id,user_id,type,title,metadata) VALUES($1,$2,'campaign.queued','Campaign queued for provider delivery',$3::jsonb)`,[auth.session.tenantId,auth.session.userId,JSON.stringify({campaignId,queued:queued.queued})]);return queued;});return result?Response.json({ok:true,status:'queueing',...result}):Response.json({ok:false,reason:'not_found'},{status:404}); }
  catch(error){return Response.json({ok:false,reason:error.code||'start_failed',message:error.message,usage:error.usage||null},{status:error.status||409});}
}
