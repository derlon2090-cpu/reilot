import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const { Client } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required.");

const parsedUrl = new URL(databaseUrl);
if (!new Set(["127.0.0.1", "localhost"]).has(parsedUrl.hostname)) {
  throw new Error("This verifier only runs against an isolated local PostgreSQL instance.");
}

const migrationDirectory = path.resolve("drizzle");
const migrations = (await fs.readdir(migrationDirectory))
  .filter((name) => /^\d+.*\.sql$/.test(name))
  .sort();
assert.equal(migrations.at(-1), "0059_salla_public_page_token_hardening.sql");

const runId = `${Date.now()}_${process.pid}`;
const schemaNames = {
  fresh: `salla_smart_fresh_${runId}`,
  legacy: `salla_smart_legacy_${runId}`
};

async function connect(schemaName) {
  const client = new Client({ connectionString: databaseUrl, ssl: false });
  await client.connect();
  await client.query(`CREATE SCHEMA ${schemaName}`);
  await client.query(`SET search_path TO ${schemaName}, public`);
  return client;
}

async function applyMigrations(client, files) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  for (const name of files) {
    const sql = await fs.readFile(path.join(migrationDirectory, name), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations(name) VALUES ($1)", [name]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      error.message = `${name}: ${error.message}`;
      throw error;
    }
  }
}

async function seedTenantAndConnection(client, suffix) {
  const tenant = await client.query(
    "INSERT INTO tenants(name,slug) VALUES ($1,$2) RETURNING id",
    [`Smart Delivery ${suffix}`, `smart-delivery-${suffix}-${runId}`]
  );
  const storeId = `store-${suffix}-${runId}`;
  const connection = await client.query(
    `INSERT INTO app_connections(tenant_id,provider,provider_store_id,provider_store_name,status)
     VALUES ($1,'salla',$2,$3,'connected') RETURNING id`,
    [tenant.rows[0].id, storeId, `Store ${suffix}`]
  );
  return { tenantId: tenant.rows[0].id, connectionId: connection.rows[0].id, storeId };
}

async function expectDatabaseError(client, sql, values, expectedCode) {
  await client.query("SAVEPOINT expected_error");
  try {
    await client.query(sql, values);
    assert.fail(`Expected PostgreSQL error ${expectedCode}`);
  } catch (error) {
    assert.equal(error.code, expectedCode);
  } finally {
    await client.query("ROLLBACK TO SAVEPOINT expected_error");
    await client.query("RELEASE SAVEPOINT expected_error");
  }
}

async function verifyFresh() {
  const client = await connect(schemaNames.fresh);
  try {
    await applyMigrations(client, migrations);
    const owner = await seedTenantAndConnection(client, "fresh");
    const other = await seedTenantAndConnection(client, "other");

    await client.query(
      `INSERT INTO salla_delivery_source_configs(
         tenant_id,salla_integration_id,store_id,source_type,source_field_key
       ) VALUES ($1,$2,$3,'item_custom_field','renvix_delivery_content')`,
      [owner.tenantId, owner.connectionId, owner.storeId]
    );

    await client.query("BEGIN");
    await expectDatabaseError(
      client,
      `INSERT INTO salla_delivery_source_configs(
         tenant_id,salla_integration_id,store_id,source_type,source_field_key
       ) VALUES ($1,$2,$3,'item_custom_field','another_field')`,
      [owner.tenantId, owner.connectionId, owner.storeId],
      "23505"
    );
    await expectDatabaseError(
      client,
      `INSERT INTO salla_delivery_source_configs(
         tenant_id,salla_integration_id,store_id,source_type,source_field_key
       ) VALUES ($1,$2,$3,'notes_scan','unsafe')`,
      [other.tenantId, other.connectionId, other.storeId],
      "23514"
    );
    await client.query("COMMIT");

    await client.query(
      `INSERT INTO salla_order_transition_state(
         tenant_id,store_id,external_order_id,current_status_id,current_status_slug,
         completed_at,latest_event_at,latest_event_id
       ) VALUES ($1,$2,'order-1','completed-id','completed',$3,$3,'event-new')`,
      [owner.tenantId, owner.storeId, "2026-08-04T10:00:00Z"]
    );
    const stale = await client.query(
      `UPDATE salla_order_transition_state
          SET current_status_slug='processing',latest_event_at=$4,latest_event_id='event-old'
        WHERE tenant_id=$1 AND store_id=$2 AND external_order_id=$3 AND latest_event_at <= $4
        RETURNING latest_event_id`,
      [owner.tenantId, owner.storeId, "order-1", "2026-08-04T09:00:00Z"]
    );
    assert.equal(stale.rowCount, 0);

    await client.query(
      `INSERT INTO salla_digital_entitlements(
         tenant_id,store_id,external_order_id,external_order_item_id,product_name,
         duration_days,duration_source,starts_at,expires_at
       ) VALUES ($1,$2,'order-1','item-1','Product A',30,'delivery_content',$3,$3::timestamptz + interval '30 days')`,
      [owner.tenantId, owner.storeId, "2026-08-04T10:00:00Z"]
    );

    await client.query("BEGIN");
    await expectDatabaseError(
      client,
      `INSERT INTO salla_digital_entitlements(
         tenant_id,store_id,external_order_id,external_order_item_id,product_name,
         duration_days,duration_source,starts_at
       ) VALUES ($1,$2,'order-1','item-1','Duplicate',30,'delivery_content',now())`,
      [owner.tenantId, owner.storeId],
      "23505"
    );
    await expectDatabaseError(
      client,
      `INSERT INTO salla_digital_entitlements(
         tenant_id,store_id,external_order_id,external_order_item_id,product_name,
         duration_days,duration_source,starts_at
       ) VALUES ($1,$2,'order-1','item-invalid','Invalid',30,'model_guess',now())`,
      [owner.tenantId, owner.storeId],
      "23514"
    );
    await client.query("COMMIT");

    const relationNames = [
      "salla_delivery_source_configs",
      "salla_order_transition_state",
      "salla_digital_entitlements"
    ];
    const tables = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname=$1 AND tablename=ANY($2::text[])",
      [schemaNames.fresh, relationNames]
    );
    assert.equal(tables.rowCount, relationNames.length);

    return {
      schema: schemaNames.fresh,
      migrationsApplied: migrations.length,
      trustedSourceUnique: true,
      unsafeSourceRejected: true,
      staleTransitionRejected: true,
      entitlementUniquePerItem: true,
      durationSourceConstraint: true,
      tenantStoreIsolationColumns: true
    };
  } finally {
    await client.end();
  }
}

async function verifyLegacyUpgrade() {
  const client = await connect(schemaNames.legacy);
  try {
    const before0054 = migrations.filter((name) => name < "0054_salla_template_system_v2.sql");
    const from0054 = migrations.filter((name) => name >= "0054_salla_template_system_v2.sql");
    await applyMigrations(client, before0054);
    const owner = await seedTenantAndConnection(client, "legacy");

    const oldSettings = {
      legacyFlag: true,
      channelContents: {
        whatsapp: { body: "Legacy WhatsApp body" },
        email: { subject: "Legacy subject", body: "Legacy email body" }
      }
    };
    await client.query(
      `INSERT INTO tenant_salla_templates(
         tenant_id,salla_integration_id,template_key,is_enabled,trigger_type,
         delivery_channel,email_subject,message_body,settings
       ) VALUES ($1,$2,'salla_order_processing',true,'order_status','whatsapp',$3,$4,$5::jsonb)`,
      [owner.tenantId, owner.connectionId, "Legacy subject", "Legacy WhatsApp body", JSON.stringify(oldSettings)]
    );

    await applyMigrations(client, from0054);
    const upgraded = (await client.query(
      `SELECT template_key,delivery_channel,message_body,whatsapp_content,
              email_text_content,email_html_content,settings
         FROM tenant_salla_templates
        WHERE tenant_id=$1 AND template_key='salla_order_processing'`,
      [owner.tenantId]
    )).rows[0];

    assert.equal(upgraded.delivery_channel, "whatsapp");
    assert.equal(upgraded.message_body, "Legacy WhatsApp body");
    assert.equal(upgraded.whatsapp_content, "Legacy WhatsApp body");
    assert.equal(upgraded.email_text_content, "Legacy email body");
    assert.equal(upgraded.email_html_content, "Legacy email body");
    assert.equal(upgraded.settings.legacyFlag, true);

    return {
      schema: schemaNames.legacy,
      migrationsApplied: migrations.length,
      legacyTemplateKey: upgraded.template_key,
      legacyChannelPreserved: true,
      legacyWhatsAppPreserved: true,
      legacyEmailPreserved: true,
      legacySettingsPreserved: true
    };
  } finally {
    await client.end();
  }
}

async function cleanupTemporarySchemas() {
  const client = new Client({ connectionString: databaseUrl, ssl: false });
  await client.connect();
  try {
    for (const schemaName of Object.values(schemaNames)) {
      assert.match(schemaName, /^salla_smart_(fresh|legacy)_\d+_\d+$/);
      await client.query(`DROP SCHEMA ${schemaName} CASCADE`);
    }
  } finally {
    await client.end();
  }
}

let report;
try {
  report = { fresh: await verifyFresh(), legacy: await verifyLegacyUpgrade() };
} finally {
  await cleanupTemporarySchemas();
}
console.log(JSON.stringify({ ...report, temporarySchemasRemoved: true }, null, 2));
