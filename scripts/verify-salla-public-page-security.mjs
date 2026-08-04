import assert from "node:assert/strict";
import { query } from "../src/server/db.js";
import { getOrCreateSallaPublicPage, resolveSallaPublicPage, revokeSallaPublicPages } from "../src/server/salla-public-pages.js";

const databaseUrl = new URL(process.env.DATABASE_URL || "");
if (!new Set(["127.0.0.1", "localhost"]).has(databaseUrl.hostname)) {
  throw new Error("This verifier only runs against an isolated local PostgreSQL instance.");
}

async function seedOwner(suffix) {
  const tenant = await query(
    "INSERT INTO tenants(name,slug) VALUES($1,$2) RETURNING id",
    [`Public page verifier ${suffix}`, `public-page-verifier-${suffix}-${Date.now()}`]
  );
  const tenantId = tenant.rows[0].id;
  const connection = await query(
    `INSERT INTO app_connections(tenant_id,provider,provider_store_id,provider_store_name,status)
     VALUES($1,'salla',$2,$3,'connected') RETURNING id`,
    [tenantId, `test-store-${suffix}-${Date.now()}`, `Test store ${suffix}`]
  );
  const template = await query(
    `INSERT INTO tenant_salla_templates(
       tenant_id,salla_integration_id,template_key,is_enabled,trigger_type,delivery_channel,message_body
     ) VALUES($1,$2,$3,true,'order_status','whatsapp','Local verifier') RETURNING id`,
    [tenantId, connection.rows[0].id, `verifier_${suffix}_${Date.now()}`]
  );
  return { tenantId, storeId: `test-store-${suffix}`, templateId: template.rows[0].id };
}

function credentials(url) {
  const parsed = new URL(url);
  return {
    publicId: parsed.pathname.split("/").filter(Boolean).at(-1),
    token: parsed.searchParams.get("t")
  };
}

async function cleanupTenant(tenantId) {
  // Remove verifier-owned child rows while the tenant still exists so the
  // storage accounting trigger can update its FK-backed counter safely.
  await query("DELETE FROM salla_public_pages WHERE tenant_id=$1", [tenantId]);
  await query("DELETE FROM tenant_salla_templates WHERE tenant_id=$1", [tenantId]);
  await query("DELETE FROM app_connections WHERE tenant_id=$1", [tenantId]);
  await query("DELETE FROM tenant_storage_usage WHERE tenant_id=$1", [tenantId]);
  await query("DELETE FROM tenants WHERE id=$1", [tenantId]);
}

const staleVerifierTenants = await query(
  "SELECT id FROM tenants WHERE slug LIKE 'public-page-verifier-%'"
);
for (const row of staleVerifierTenants.rows) await cleanupTenant(row.id);

const owners = [];
try {
  const owner = await seedOwner("owner");
  const other = await seedOwner("other");
  owners.push(owner.tenantId, other.tenantId);

  const oneViewPage = await getOrCreateSallaPublicPage({
    ...owner,
    pageType: "order",
    externalEntityId: `concurrency-${Date.now()}`,
    source: { maxViews: 1, order: { id: "local-order", reference_id: "LOCAL-1" } }
  });
  assert.equal(oneViewPage.ok, true);
  const oneView = credentials(oneViewPage.url);
  assert.match(oneView.publicId, /^sord_[A-Za-z0-9_-]{22}$/);
  assert.equal(oneView.token.length, 43);

  const stored = (await query(
    `SELECT token_ciphertext AS "tokenCiphertext",view_count AS "viewCount"
       FROM salla_public_pages WHERE public_id=$1`,
    [oneView.publicId]
  )).rows[0];
  assert.equal(stored.tokenCiphertext, null);
  assert.equal(stored.viewCount, 0);

  const concurrent = await Promise.all(
    Array.from({ length: 20 }, () => resolveSallaPublicPage(oneView.publicId, oneView.token))
  );
  assert.equal(concurrent.filter((item) => item.ok).length, 1);
  assert.equal(concurrent.filter((item) => item.reason === "view_limit_reached").length, 19);
  const afterConcurrency = (await query(
    "SELECT view_count AS count FROM salla_public_pages WHERE public_id=$1",
    [oneView.publicId]
  )).rows[0];
  assert.equal(afterConcurrency.count, 1);
  assert.equal((await resolveSallaPublicPage(oneView.publicId, "invalid-token-value-that-is-long-enough-000000")).reason, "invalid_link");

  const otherPage = await getOrCreateSallaPublicPage({
    ...other,
    pageType: "order",
    externalEntityId: `other-${Date.now()}`,
    source: { order: { id: "other-order" } }
  });
  const otherCredentials = credentials(otherPage.url);
  assert.equal((await resolveSallaPublicPage(oneView.publicId, otherCredentials.token)).reason, "invalid_link");

  const expiredPage = await getOrCreateSallaPublicPage({
    ...owner,
    pageType: "order",
    externalEntityId: `expired-${Date.now()}`,
    source: { maxViews: 1, order: { id: "expired-order" } }
  });
  const expired = credentials(expiredPage.url);
  await query("UPDATE salla_public_pages SET expires_at=now()-interval '1 minute' WHERE public_id=$1", [expired.publicId]);
  assert.equal((await resolveSallaPublicPage(expired.publicId, expired.token)).reason, "expired");
  assert.equal(Number((await query("SELECT view_count FROM salla_public_pages WHERE public_id=$1", [expired.publicId])).rows[0].view_count), 0);

  const revokedEntity = `revoked-${Date.now()}`;
  const revokedPage = await getOrCreateSallaPublicPage({
    ...owner,
    pageType: "order",
    externalEntityId: revokedEntity,
    source: { order: { id: "revoked-order" } }
  });
  const revoked = credentials(revokedPage.url);
  await revokeSallaPublicPages({ ...owner, externalEntityId: revokedEntity, reason: "local_test" });
  assert.equal((await resolveSallaPublicPage(revoked.publicId, revoked.token)).reason, "revoked");

  console.log(JSON.stringify({
    publicIdRandomBits: 128,
    tokenRandomBits: 256,
    rawTokenStored: false,
    concurrentRequests: 20,
    successfulViews: 1,
    rejectedByViewLimit: 19,
    expiredViewCountUnchanged: true,
    crossPageTokenRejected: true,
    revokedTokenRejected: true
  }, null, 2));
} finally {
  for (const tenantId of owners) await cleanupTenant(tenantId);
}
