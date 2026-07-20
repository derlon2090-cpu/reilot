import { query, transaction } from "../../../../../src/server/db.js";
import { requireSession } from "../../../../../src/server/session.js";

const units = new Set(["day","month","year"]);
const triggers = new Set(["payment_completed","order_completed","manual_activation","specific_order_status"]);
const quantityBehaviors = new Set(["multiply_duration","create_multiple_subscriptions"]);

export async function GET(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const [products,mappings,plans,unmapped] = await Promise.all([
    query(`SELECT id,salla_product_id AS "productId",salla_variant_id AS "variantId",sku,name,price,currency,status
      FROM salla_products WHERE tenant_id=$1 ORDER BY name,sku`,[auth.session.tenantId]),
    query(`SELECT ppm.id,ppm.salla_product_id AS "productId",ppm.salla_variant_id AS "variantId",
      ppm.salla_product_sku AS sku,ppm.internal_plan_id AS "planId",sp.name AS "planName",
      ppm.duration_value AS "durationValue",ppm.duration_unit AS "durationUnit",ppm.start_trigger AS "startTrigger",
      ppm.quantity_behavior AS "quantityBehavior",ppm.is_active AS "isActive"
      FROM product_plan_mappings ppm JOIN subscription_plans sp ON sp.id=ppm.internal_plan_id
      WHERE ppm.tenant_id=$1 ORDER BY ppm.updated_at DESC`,[auth.session.tenantId]),
    query("SELECT id,name,duration_value AS \"durationValue\",duration_unit AS \"durationUnit\",salla_product_url AS \"renewalUrl\" FROM subscription_plans WHERE tenant_id=$1 AND is_active=true ORDER BY name",[auth.session.tenantId]),
    query(`SELECT id,order_number AS "orderNumber",product_name AS "productName",salla_product_id AS "productId",
      salla_variant_id AS "variantId",sku,quantity FROM unmapped_order_items
      WHERE tenant_id=$1 AND status='needs_mapping' ORDER BY created_at DESC LIMIT 100`,[auth.session.tenantId])
  ]);
  return Response.json({ok:true,products:products.rows,mappings:mappings.rows,plans:plans.rows,unmapped:unmapped.rows});
}

export async function POST(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(()=>({}));
  const durationValue=Number(body.durationValue);
  let renewalUrl=null;
  if(String(body.renewalUrl||"").trim()){
    try{const parsed=new URL(String(body.renewalUrl).trim());if(parsed.protocol!=="https:")throw new Error();renewalUrl=parsed.toString();}
    catch{return Response.json({ok:false,reason:"invalid_renewal_url"},{status:400});}
  }
  if(!body.productId||(!body.planId&&!String(body.newPlanName||"").trim())||!Number.isInteger(durationValue)||durationValue<1||!units.has(body.durationUnit)||!triggers.has(body.startTrigger)||!quantityBehaviors.has(body.quantityBehavior))
    return Response.json({ok:false,reason:"invalid_mapping"},{status:400});
  if(body.startTrigger==="specific_order_status"&&!String(body.specificOrderStatus||"").trim())
    return Response.json({ok:false,reason:"specific_order_status_required"},{status:400});
  const item=await transaction(async(client)=>{
    const plan=body.planId
      ? await client.query("SELECT id FROM subscription_plans WHERE id=$1 AND tenant_id=$2",[body.planId,auth.session.tenantId])
      : await client.query(`INSERT INTO subscription_plans (tenant_id,name,duration_value,duration_unit,salla_product_url)
          VALUES ($1,$2,$3,$4,$5) ON CONFLICT (tenant_id,name) DO UPDATE SET
          duration_value=EXCLUDED.duration_value,duration_unit=EXCLUDED.duration_unit,
          salla_product_url=COALESCE(EXCLUDED.salla_product_url,subscription_plans.salla_product_url),updated_at=now() RETURNING id`,
          [auth.session.tenantId,String(body.newPlanName).trim().slice(0,120),durationValue,body.durationUnit,renewalUrl]);
    if(!plan.rows[0]) return null;
    if(body.planId&&renewalUrl)await client.query("UPDATE subscription_plans SET salla_product_url=$3,updated_at=now() WHERE id=$1 AND tenant_id=$2",[plan.rows[0].id,auth.session.tenantId,renewalUrl]);
    const connection=await client.query("SELECT id FROM app_connections WHERE tenant_id=$1 AND provider='salla' LIMIT 1",[auth.session.tenantId]);
    const saved=await client.query(`INSERT INTO product_plan_mappings
      (tenant_id,connection_id,salla_product_id,salla_product_sku,salla_variant_id,internal_plan_id,
       duration_value,duration_unit,start_trigger,specific_order_status,quantity_behavior,is_subscription_product,is_active)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,true)
      ON CONFLICT (tenant_id,salla_product_id,COALESCE(salla_variant_id,'')) DO UPDATE SET
       salla_product_sku=EXCLUDED.salla_product_sku,internal_plan_id=EXCLUDED.internal_plan_id,
       duration_value=EXCLUDED.duration_value,duration_unit=EXCLUDED.duration_unit,start_trigger=EXCLUDED.start_trigger,
       specific_order_status=EXCLUDED.specific_order_status,quantity_behavior=EXCLUDED.quantity_behavior,is_active=true,updated_at=now()
      RETURNING id`,[auth.session.tenantId,connection.rows[0]?.id||null,String(body.productId),body.sku||null,body.variantId?String(body.variantId):null,
       plan.rows[0].id,durationValue,body.durationUnit,body.startTrigger,body.specificOrderStatus||null,body.quantityBehavior]);
    await client.query("UPDATE unmapped_order_items SET status='mapped',updated_at=now() WHERE tenant_id=$1 AND salla_product_id=$2 AND COALESCE(salla_variant_id,'')=COALESCE($3,'')",[auth.session.tenantId,String(body.productId),body.variantId?String(body.variantId):null]);
    return saved.rows[0];
  });
  return item?Response.json({ok:true,item},{status:201}):Response.json({ok:false,reason:"plan_not_found"},{status:404});
}

export async function DELETE(req){
  const auth=await requireSession(req);if(!auth.ok)return auth.response;
  const id=new URL(req.url).searchParams.get("id");
  const result=await query("UPDATE product_plan_mappings SET is_active=false,updated_at=now() WHERE id=$1 AND tenant_id=$2 RETURNING id",[id,auth.session.tenantId]);
  return result.rows[0]?Response.json({ok:true}):Response.json({ok:false},{status:404});
}
