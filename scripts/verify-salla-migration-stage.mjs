import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const { Client } = pg;
const freshUrl = process.env.SALLA_STAGE_FRESH_DATABASE_URL;
const legacyUrl = process.env.SALLA_STAGE_LEGACY_DATABASE_URL;
if (!freshUrl || !legacyUrl) throw new Error("Two isolated Salla staging database URLs are required.");

const expectedKeys = [
  "digital_product_delivery", "processing", "under_review", "delivered",
  "out_for_delivery", "completed", "review_request", "abandoned_cart",
  "cancelled", "return_in_progress", "returned", "shipped"
];
const migrationDir = path.resolve("drizzle");
const migrations = (await fs.readdir(migrationDir)).filter((name) => /^\d+.*\.sql$/.test(name)).sort();
assert.equal(migrations.at(-1), "0054_salla_template_system_v2.sql");

async function connect(url) {
  const client = new Client({ connectionString: url, ssl: false });
  await client.connect();
  return client;
}

async function applyMigrations(client, files) {
  await client.query("CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())");
  for (const name of files) {
    if ((await client.query("SELECT 1 FROM schema_migrations WHERE name=$1", [name])).rowCount) continue;
    const sql = await fs.readFile(path.join(migrationDir, name), "utf8");
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

async function expectConstraint(client, sql, values, code) {
  await client.query("SAVEPOINT expected_constraint");
  try {
    await client.query(sql, values);
    assert.fail(`Expected PostgreSQL error ${code}`);
  } catch (error) {
    assert.equal(error.code, code);
  } finally {
    await client.query("ROLLBACK TO SAVEPOINT expected_constraint");
    await client.query("RELEASE SAVEPOINT expected_constraint");
  }
}

async function seedTenant(client, suffix) {
  const tenant = await client.query("INSERT INTO tenants(name,slug) VALUES ($1,$2) RETURNING id", [`Stage ${suffix}`, `stage-${suffix}`]);
  const connection = await client.query(
    `INSERT INTO app_connections(tenant_id,provider,provider_store_id,provider_store_name,status)
     VALUES ($1,'salla',$2,$3,'connected') RETURNING id`,
    [tenant.rows[0].id, `store-${suffix}`, `Store ${suffix}`]
  );
  return { tenantId: tenant.rows[0].id, connectionId: connection.rows[0].id, storeId: `store-${suffix}` };
}

async function insertStageTemplates(client, tenant) {
  for (const [index, key] of expectedKeys.entries()) {
    const channel = index % 2 === 0 ? "whatsapp" : "email";
    await client.query(
      `INSERT INTO tenant_salla_templates(
         tenant_id,salla_integration_id,template_key,trigger_type,delivery_channel,message_body,
         whatsapp_content,email_text_content,email_html_content
       ) VALUES ($1,$2,$3,'event',$4,$5,$6,$7,$8)`,
      [tenant.tenantId, tenant.connectionId, key, channel, `body:${key}`, `wa:${key}`, `email:${key}`, `<p>email:${key}</p>`]
    );
  }
}

async function verifyReviewCancellation(client, tenantId, templateId, orderId, reason) {
  const queue = await client.query(
    `INSERT INTO message_queue(tenant_id,scheduled_for,status,message_type,channel_type)
     VALUES ($1,now() + interval '1 day','pending','salla_template','email') RETURNING id`, [tenantId]
  );
  const delivery = await client.query(
    `INSERT INTO salla_template_deliveries(
       tenant_id,template_id,template_key,external_order_id,channel,recipient_hash,message_queue_id,idempotency_key
     ) VALUES ($1,$2,'review_request',$3,'email','hash',$4,$5) RETURNING id`,
    [tenantId, templateId, orderId, queue.rows[0].id, `review:${reason}`]
  );
  await client.query(
    `UPDATE message_queue queue SET status='cancelled',last_error='review_request_no_longer_valid',updated_at=now()
      FROM salla_template_deliveries delivery
     WHERE delivery.message_queue_id=queue.id AND delivery.tenant_id=$1
       AND delivery.external_order_id=$2 AND delivery.template_key='review_request' AND queue.status='pending'`,
    [tenantId, orderId]
  );
  await client.query(
    `UPDATE salla_template_deliveries SET status='skipped',failure_code='review_request_cancelled',updated_at=now()
      WHERE tenant_id=$1 AND external_order_id=$2 AND template_key='review_request' AND status='queued'`,
    [tenantId, orderId]
  );
  assert.deepEqual((await client.query("SELECT status,last_error FROM message_queue WHERE id=$1", [queue.rows[0].id])).rows[0], {
    status: "cancelled", last_error: "review_request_no_longer_valid"
  });
  assert.deepEqual((await client.query("SELECT status,failure_code FROM salla_template_deliveries WHERE id=$1", [delivery.rows[0].id])).rows[0], {
    status: "skipped", failure_code: "review_request_cancelled"
  });
}

async function verifyFreshDatabase() {
  const client = await connect(freshUrl);
  try {
    await applyMigrations(client, migrations);
    assert.equal(Number((await client.query("SELECT count(*) count FROM schema_migrations")).rows[0].count), migrations.length);
    const first = await seedTenant(client, "fresh-a");
    const second = await seedTenant(client, "fresh-b");
    await insertStageTemplates(client, first);
    await client.query(
      `INSERT INTO tenant_salla_templates(
         tenant_id,salla_integration_id,template_key,trigger_type,delivery_channel,message_body,
         whatsapp_content,email_text_content,email_html_content
       ) VALUES ($1,$2,$3,'event','email','second tenant','second wa','second email','<p>second email</p>')`,
      [second.tenantId, second.connectionId, expectedKeys[0]]
    );

    await client.query("BEGIN");
    await expectConstraint(client,
      "INSERT INTO tenant_salla_templates(tenant_id,salla_integration_id,template_key,trigger_type,message_body) VALUES ($1,$2,$3,'event','duplicate')",
      [first.tenantId, first.connectionId, expectedKeys[0]], "23505");
    await expectConstraint(client,
      "INSERT INTO tenant_salla_templates(tenant_id,salla_integration_id,template_key,trigger_type,delivery_channel,message_body) VALUES ($1,$2,'invalid-channel','event','sms','invalid')",
      [first.tenantId, first.connectionId], "23514");
    await client.query("COMMIT");

    const rows = await client.query(
      `SELECT t.template_key,t.delivery_channel,t.whatsapp_content,t.email_text_content,
              c.provider_store_id,c.tenant_id AS connection_tenant
         FROM tenant_salla_templates t JOIN app_connections c ON c.id=t.salla_integration_id
        WHERE t.tenant_id=$1 ORDER BY array_position($2::text[],t.template_key)`,
      [first.tenantId, expectedKeys]
    );
    assert.deepEqual(rows.rows.map((row) => row.template_key), expectedKeys);
    assert.equal(rows.rows.every((row) => row.provider_store_id === first.storeId && row.connection_tenant === first.tenantId), true);
    assert.equal(rows.rows.every((row) => ["whatsapp", "email"].includes(row.delivery_channel)), true);
    assert.equal(rows.rows.every((row) => row.whatsapp_content !== row.email_text_content), true);
    assert.equal(Number((await client.query("SELECT count(*) count FROM tenant_salla_templates WHERE tenant_id=$1", [second.tenantId])).rows[0].count), 1);

    const reviewTemplateId = (await client.query(
      "SELECT id FROM tenant_salla_templates WHERE tenant_id=$1 AND template_key='review_request'", [first.tenantId]
    )).rows[0].id;
    await client.query(
      `INSERT INTO salla_template_deliveries(tenant_id,template_id,template_key,external_order_id,channel,recipient_hash,idempotency_key)
       VALUES ($1,$2,'review_request','order-idempotent','email','hash','same-idempotency')`, [first.tenantId, reviewTemplateId]
    );
    await client.query("BEGIN");
    await expectConstraint(client,
      `INSERT INTO salla_template_deliveries(tenant_id,template_id,template_key,external_order_id,channel,recipient_hash,idempotency_key)
       VALUES ($1,$2,'review_request','order-idempotent','email','hash','same-idempotency')`,
      [first.tenantId, reviewTemplateId], "23505");
    await client.query("COMMIT");

    await client.query(
      `INSERT INTO salla_template_entity_state(tenant_id,template_key,external_entity_id,latest_event_at,latest_event_id)
       VALUES ($1,'processing','order-watermark','2026-08-02T12:00:00Z','new-event')`, [first.tenantId]
    );
    const stale = await client.query(
      `INSERT INTO salla_template_entity_state(tenant_id,template_key,external_entity_id,latest_event_at,latest_event_id)
       VALUES ($1,'processing','order-watermark','2026-08-02T11:00:00Z','old-event')
       ON CONFLICT (tenant_id,template_key,external_entity_id) DO UPDATE SET
         latest_event_at=EXCLUDED.latest_event_at,latest_event_id=EXCLUDED.latest_event_id,updated_at=now()
       WHERE salla_template_entity_state.latest_event_at<=EXCLUDED.latest_event_at RETURNING latest_event_id`, [first.tenantId]
    );
    assert.equal(stale.rowCount, 0);
    assert.equal((await client.query(
      "SELECT latest_event_id FROM salla_template_entity_state WHERE tenant_id=$1 AND template_key='processing' AND external_entity_id='order-watermark'",
      [first.tenantId]
    )).rows[0].latest_event_id, "new-event");

    await verifyReviewCancellation(client, first.tenantId, reviewTemplateId, "order-cancelled", "cancelled");
    await verifyReviewCancellation(client, first.tenantId, reviewTemplateId, "order-return-started", "return-started");

    const cartTemplateId = (await client.query(
      "SELECT id FROM tenant_salla_templates WHERE tenant_id=$1 AND template_key='abandoned_cart'", [first.tenantId]
    )).rows[0].id;
    const cartQueue = await client.query(
      `INSERT INTO message_queue(tenant_id,scheduled_for,status,message_type,channel_type)
       VALUES ($1,now() + interval '30 minutes','pending','salla_template','whatsapp') RETURNING id`, [first.tenantId]
    );
    await client.query("INSERT INTO abandoned_cart_sequences(tenant_id,template_id,external_cart_id,status) VALUES ($1,$2,'cart-purchased','active')", [first.tenantId, cartTemplateId]);
    await client.query(
      `INSERT INTO salla_template_deliveries(tenant_id,template_id,template_key,external_cart_id,channel,recipient_hash,message_queue_id,idempotency_key)
       VALUES ($1,$2,'abandoned_cart','cart-purchased','whatsapp','hash',$3,'cart:once')`, [first.tenantId, cartTemplateId, cartQueue.rows[0].id]
    );
    await client.query("UPDATE abandoned_cart_sequences SET status='converted',converted_order_id='order-from-cart',cancelled_at=now(),updated_at=now() WHERE tenant_id=$1 AND external_cart_id='cart-purchased' AND status='active'", [first.tenantId]);
    await client.query(
      `UPDATE message_queue queue SET status='cancelled',last_error='abandoned_cart_converted',updated_at=now()
        FROM salla_template_deliveries delivery WHERE delivery.message_queue_id=queue.id AND delivery.tenant_id=$1
         AND delivery.external_cart_id='cart-purchased' AND queue.status='pending'`, [first.tenantId]
    );
    await client.query("UPDATE salla_template_deliveries SET status='skipped',failure_code='cart_converted',updated_at=now() WHERE tenant_id=$1 AND external_cart_id='cart-purchased' AND status='queued'", [first.tenantId]);
    assert.equal((await client.query("SELECT status FROM abandoned_cart_sequences WHERE tenant_id=$1 AND external_cart_id='cart-purchased'", [first.tenantId])).rows[0].status, "converted");
    assert.equal((await client.query("SELECT status FROM message_queue WHERE id=$1", [cartQueue.rows[0].id])).rows[0].status, "cancelled");

    return {
      migrations: migrations.length, templates: rows.rowCount,
      duplicateTemplateConstraint: "passed", channelConstraint: "passed", tenantStoreJoin: "passed",
      idempotencyConstraint: "passed", staleEventGuard: "passed", cancellationAndReturn: "passed",
      abandonedCartConversion: "passed"
    };
  } finally {
    await client.end();
  }
}

async function verifyLegacyDatabase() {
  const client = await connect(legacyUrl);
  let tenantId;
  let connectionId;
  try {
    await applyMigrations(client, migrations.filter((name) => name < "0054"));
    const seeded = await seedTenant(client, "legacy");
    tenantId = seeded.tenantId;
    connectionId = seeded.connectionId;
    await client.query(
      `INSERT INTO tenant_salla_templates(
         tenant_id,salla_integration_id,template_key,is_enabled,trigger_type,delivery_channel,email_subject,message_body,settings
       ) VALUES ($1,$2,'salla_order_processing',true,'order_status','whatsapp','Legacy subject','Legacy body','{"legacyFlag":true}'::jsonb)`,
      [tenantId, connectionId]
    );
    await applyMigrations(client, migrations.filter((name) => name === "0054_salla_template_system_v2.sql"));
    const legacy = (await client.query(
      `SELECT delivery_channel,message_body,whatsapp_content,email_text_content,email_html_content,settings
         FROM tenant_salla_templates WHERE tenant_id=$1 AND template_key='salla_order_processing'`, [tenantId]
    )).rows[0];
    assert.equal(legacy.delivery_channel, "whatsapp");
    assert.equal(legacy.message_body, "Legacy body");
    assert.equal(legacy.whatsapp_content, "Legacy body");
    assert.equal(legacy.email_text_content, "Legacy body");
    assert.equal(legacy.email_html_content, "Legacy body");
    assert.equal(legacy.settings.legacyFlag, true);
  } finally {
    await client.end();
  }

  process.env.DATABASE_URL = legacyUrl;
  process.env.DATABASE_SSL = "false";
  const templatesModule = await import("../src/server/salla-templates.js");
  await templatesModule.ensureSallaAutomationTemplates(tenantId, connectionId);
  const payload = await templatesModule.listSallaAutomationTemplates({ tenantId });
  const list = payload.items;
  assert.deepEqual(list.map((item) => item.templateKey), expectedKeys);
  const processing = list.find((item) => item.templateKey === "processing");
  assert.equal(processing.channel, "whatsapp");
  assert.equal(processing.whatsappContent, "Legacy body");
  assert.equal(processing.emailTextContent, "Legacy body");
  assert.equal(processing.settings.legacyFlag, true);
  const { getPool } = await import("../src/server/db.js");
  await getPool().end();
  return {
    migrations: migrations.length,
    legacyBodyPreserved: true,
    legacySettingsPreserved: true,
    legacyChannelPreserved: true,
    seededTemplateOrder: list.map((item) => item.templateKey)
  };
}

console.log(JSON.stringify({ fresh: await verifyFreshDatabase(), legacy: await verifyLegacyDatabase() }, null, 2));
