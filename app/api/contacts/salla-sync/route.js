import { transaction } from "../../../../src/server/db.js";
import { requireSession } from "../../../../src/server/session.js";
import { sameOriginRequest, upsertCampaignContact } from "../../../../src/server/campaign-contacts.js";

export async function POST(request){
  const auth=await requireSession(request);if(!auth.ok)return auth.response;
  if(!sameOriginRequest(request))return Response.json({ok:false,reason:'invalid_origin'},{status:403});
  const result=await transaction(async client=>{
    const customers=await client.query(`SELECT id,name,email,COALESCE(NULLIF(whatsapp_number,''),phone) AS phone,external_customer_id FROM customers WHERE tenant_id=$1 AND external_provider='salla' ORDER BY created_at`,[auth.session.tenantId]);
    let imported=0,needsReview=0;
    for(const customer of customers.rows){const saved=await upsertCampaignContact(client,{tenantId:auth.session.tenantId,userId:auth.session.userId,displayName:customer.name,email:customer.email,phone:customer.phone,source:'salla',sallaCustomerId:customer.external_customer_id,externalReference:`customer:${customer.id}`});saved.conflict?needsReview+=1:imported+=1;}
    return {total:customers.rowCount,imported,needsReview};
  });
  return Response.json({ok:true,...result});
}
