import crypto from "node:crypto";
import { query, transaction } from "./db.js";
import { randomToken, sha256 } from "./security.js";

function encryptionKey() {
  const secret=process.env.ORDER_LINK_ENCRYPTION_KEY||process.env.ENCRYPTION_KEY;
  if(!secret) throw new Error("ORDER_LINK_ENCRYPTION_KEY is missing");
  return crypto.createHash("sha256").update(secret).digest();
}

function encryptSecret(value) {
  const iv=crypto.randomBytes(12);const cipher=crypto.createCipheriv("aes-256-gcm",encryptionKey(),iv);
  const encrypted=Buffer.concat([cipher.update(value,"utf8"),cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decryptSecret(value) {
  const [iv,tag,data]=String(value||"").split(".");
  const decipher=crypto.createDecipheriv("aes-256-gcm",encryptionKey(),Buffer.from(iv,"base64url"));
  decipher.setAuthTag(Buffer.from(tag,"base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data,"base64url")),decipher.final()]).toString("utf8");
}

function portalUrl(publicId,secret) {
  const base=String(process.env.NEXT_PUBLIC_APP_URL||process.env.BETTER_AUTH_URL||"http://localhost:3000").replace(/\/$/,"");
  const url=new URL(`/o/${encodeURIComponent(publicId)}`,base);url.searchParams.set("t",secret);return url.toString();
}

async function insertPortalLink(client,tenantId,orderId,expiresInDays) {
  const publicId=`ord_${randomToken(9)}`;const secret=randomToken(32);const days=Math.min(3650,Math.max(1,Number(expiresInDays||365)));
  const result=await client.query(`INSERT INTO order_portal_links
    (tenant_id,order_info_link_id,public_id,secret_hash,secret_ciphertext,expires_at)
    VALUES($1,$2,$3,$4,$5,now()+($6||' days')::interval) RETURNING id,public_id AS "publicId"`,
    [tenantId,orderId,publicId,sha256(secret),encryptSecret(secret),String(days)]);
  return {created:true,id:result.rows[0].id,url:portalUrl(publicId,secret)};
}

export async function getOrCreateOrderPortalLink({tenantId,orderId,expiresInDays=365}) {
  return transaction(async(client)=>{
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))",[`${tenantId}:${orderId}`]);
    const order=await client.query("SELECT id FROM order_info_links WHERE id=$1 AND tenant_id=$2 LIMIT 1",[orderId,tenantId]);
    if(!order.rows[0]) return {ok:false,reason:"order_not_found"};
    const existing=await client.query(`SELECT id,public_id AS "publicId",secret_ciphertext AS "secretCiphertext"
      FROM order_portal_links WHERE tenant_id=$1 AND order_info_link_id=$2 AND status='active' AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at>now()) LIMIT 1 FOR UPDATE`,[tenantId,orderId]);
    if(existing.rows[0]) return {ok:true,created:false,id:existing.rows[0].id,url:portalUrl(existing.rows[0].publicId,decryptSecret(existing.rows[0].secretCiphertext))};
    return {ok:true,...await insertPortalLink(client,tenantId,orderId,expiresInDays)};
  });
}

export async function regenerateOrderPortalLink({tenantId,orderId,expiresInDays=365}) {
  return transaction(async(client)=>{
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))",[`${tenantId}:${orderId}`]);
    const order=await client.query("SELECT id FROM order_info_links WHERE id=$1 AND tenant_id=$2 LIMIT 1",[orderId,tenantId]);
    if(!order.rows[0]) return {ok:false,reason:"order_not_found"};
    await client.query(`UPDATE order_portal_links SET status='revoked',revoked_at=now(),updated_at=now()
      WHERE tenant_id=$1 AND order_info_link_id=$2 AND status='active' AND revoked_at IS NULL`,[tenantId,orderId]);
    return {ok:true,...await insertPortalLink(client,tenantId,orderId,expiresInDays)};
  });
}

export async function resolveOrderPortalLink(publicId,secret) {
  if(!String(publicId||"").startsWith("ord_")||String(secret||"").length<32) return {ok:false,reason:"invalid_link"};
  return transaction(async(client)=>{
    const found=await client.query(`SELECT id,tenant_id AS "tenantId",order_info_link_id AS "orderId",status,expires_at AS "expiresAt",revoked_at AS "revokedAt"
      FROM order_portal_links WHERE public_id=$1 AND secret_hash=$2 LIMIT 1 FOR UPDATE`,[String(publicId),sha256(secret)]);
    const item=found.rows[0];
    if(!item||item.status!=="active"||item.revokedAt) return {ok:false,reason:"invalid_link"};
    if(item.expiresAt&&new Date(item.expiresAt)<=new Date()) return {ok:false,reason:"expired"};
    await client.query(`UPDATE order_portal_links SET view_count=view_count+1,first_viewed_at=COALESCE(first_viewed_at,now()),last_viewed_at=now(),updated_at=now() WHERE id=$1`,[item.id]);
    return {ok:true,...item};
  });
}
