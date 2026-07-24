import { z } from "zod";
import { transaction } from "../../../../src/server/db.js";
import { requireSession } from "../../../../src/server/session.js";
import { sameOriginRequest, upsertCampaignContact } from "../../../../src/server/campaign-contacts.js";

const schema = z.object({ rows: z.array(z.object({
  displayName: z.string().trim().max(160).optional().default(""), email: z.string().trim().max(254).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(), companyName: z.string().trim().max(160).optional().nullable()
})).min(1).max(500) });

export async function POST(request) {
  const auth=await requireSession(request); if(!auth.ok)return auth.response;
  if(!sameOriginRequest(request))return Response.json({ok:false,reason:"invalid_origin"},{status:403});
  const parsed=schema.safeParse(await request.json().catch(()=>({}))); if(!parsed.success)return Response.json({ok:false,reason:"invalid_input",issues:parsed.error.issues},{status:400});
  const result=await transaction(async client=>{
    const batch=await client.query(`INSERT INTO contact_import_batches(tenant_id,created_by,source,status,total_rows) VALUES($1,$2,'csv','processing',$3) RETURNING id`,[auth.session.tenantId,auth.session.userId,parsed.data.rows.length]);
    let imported=0,duplicates=0,invalid=0;const errors=[];
    for(let index=0;index<parsed.data.rows.length;index+=1){try{const item=await upsertCampaignContact(client,{tenantId:auth.session.tenantId,userId:auth.session.userId,...parsed.data.rows[index],source:'csv'});item.conflict?duplicates+=1:imported+=1;}catch(error){invalid+=1;errors.push({row:index+1,reason:error.code||'invalid'});}}
    await client.query(`UPDATE contact_import_batches SET status=$2,imported_rows=$3,duplicate_rows=$4,invalid_rows=$5,error_summary=$6::jsonb,completed_at=now() WHERE id=$1`,[batch.rows[0].id,invalid?'completed_with_errors':'completed',imported,duplicates,invalid,JSON.stringify(errors.slice(0,50))]);
    return {batchId:batch.rows[0].id,total:parsed.data.rows.length,imported,duplicates,invalid,errors:errors.slice(0,20)};
  });
  return Response.json({ok:true,...result},{status:201});
}
