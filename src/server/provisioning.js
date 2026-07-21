import crypto from "node:crypto";
import { hashPassword } from "./password.js";
import { query, transaction } from "./db.js";
import { normalizeEmail, isStrongPassword } from "./security.js";
import { classifyPasswordStrength } from "./security-score.js";
import { ensureDefaultTemplates } from "./default-templates.js";
import { sendQueuedEmail } from "./email/resend.service.js";

export function generateTemporaryPassword() {
  let password = "";
  do password = `Rv!${crypto.randomBytes(18).toString("base64url")}9a`;
  while (password.length < 20 || !isStrongPassword(password));
  return password;
}

export function normalizeCustomerEmail(email) {
  const value = normalizeEmail(email || "");
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : null;
}

function addDuration(date, value, unit, quantity = 1) {
  const result = new Date(date);
  const amount = Math.max(1, Number(value) || 1) * Math.max(1, Number(quantity) || 1);
  if (unit === "day") result.setUTCDate(result.getUTCDate() + amount);
  else if (unit === "year") result.setUTCFullYear(result.getUTCFullYear() + amount);
  else result.setUTCMonth(result.getUTCMonth() + amount);
  return result;
}

async function markJob(jobId, fields) {
  const entries = Object.entries(fields);
  if (!entries.length) return;
  const values = [jobId];
  const assignments = entries.map(([key, value], index) => {
    values.push(value);
    return `${key}=$${index + 2}`;
  });
  await query(`UPDATE account_provisioning_jobs SET ${assignments.join(",")},updated_at=now() WHERE id=$1`, values);
}

export async function provisionCustomerAccount(provisioningJobId) {
  const jobResult = await query(
    `SELECT apj.*, ppm.salla_store_id AS "storeId", ppm.account_creation_enabled AS "accountCreationEnabled",
            ppm.activation_trigger AS "activationTrigger", ppm.quantity_behavior AS "quantityBehavior",
            ppm.duration_value AS "mappingDurationValue", ppm.duration_unit AS "mappingDurationUnit"
       FROM account_provisioning_jobs apj
       LEFT JOIN provisioning_product_mappings ppm ON ppm.id=apj.mapping_id
      WHERE apj.id=$1`,
    [provisioningJobId]
  );
  const row = jobResult.rows[0];
  if (!row || ["completed", "cancelled"].includes(row.status)) return row || null;
  const email = normalizeCustomerEmail(row.customer_email);
  if (!email) {
    await markJob(provisioningJobId, { status: "needs_customer_email", failure_code: "NEEDS_CUSTOMER_EMAIL" });
    return null;
  }
  if (row.accountCreationEnabled === false) {
    await markJob(provisioningJobId, { status: "cancelled", failure_code: "ACCOUNT_CREATION_DISABLED" });
    return null;
  }

  const result = await transaction(async (client) => {
    await client.query("UPDATE account_provisioning_jobs SET status='creating_account',attempts=attempts+1,updated_at=now() WHERE id=$1", [provisioningJobId]);
    const existingResult = await client.query("SELECT id,tenant_id,name,email,must_change_password FROM users WHERE lower(email)=$1 LIMIT 1 FOR UPDATE", [email]);
    let user = existingResult.rows[0] || null;
    let tenantId = user?.tenant_id || null;
    let temporaryPassword = null;
    let accountCreated = false;
    if (!user) {
      temporaryPassword = generateTemporaryPassword();
      const workspace = String(row.customer_name || "Renvix").trim() || "Renvix";
      const slug = `${workspace.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 36) || "renvix"}-${crypto.randomBytes(3).toString("hex")}`;
      const tenant = await client.query("INSERT INTO tenants (name,slug,status) VALUES ($1,$2,'active') RETURNING id", [workspace, slug]);
      tenantId = tenant.rows[0].id;
      const inserted = await client.query(
        `INSERT INTO users (tenant_id,name,email,role,password_strength,password_changed_at,must_change_password,password_initialized_at)
         VALUES ($1,$2,$3,'owner',$4,NULL,true,now()) RETURNING id,tenant_id,name,email`,
        [tenantId, workspace, email, classifyPasswordStrength(temporaryPassword, email)]
      );
      user = inserted.rows[0];
      await client.query("INSERT INTO accounts (user_id,account_id,provider_id,password) VALUES ($1,$2,'credential',$3)", [user.id, email, await hashPassword(temporaryPassword)]);
      await client.query("INSERT INTO tenant_members (tenant_id,user_id,role) VALUES ($1,$2,'owner') ON CONFLICT DO NOTHING", [tenantId, user.id]);
      await client.query("INSERT INTO stores (tenant_id,name) VALUES ($1,$2)", [tenantId, workspace]);
      await client.query("INSERT INTO settings (tenant_id,language,theme) VALUES ($1,'ar','light') ON CONFLICT DO NOTHING", [tenantId]);
      await client.query("INSERT INTO whatsapp_safety_settings (tenant_id) VALUES ($1) ON CONFLICT DO NOTHING", [tenantId]).catch(() => null);
      await ensureDefaultTemplates(client, tenantId, workspace).catch(() => null);
      accountCreated = true;
      await client.query("UPDATE account_provisioning_jobs SET account_created_at=now(),tenant_created_at=now() WHERE id=$1", [provisioningJobId]);
    } else if (!tenantId) {
      const tenant = await client.query("INSERT INTO tenants (name,slug,status) VALUES ($1,$2,'active') RETURNING id", [`مساحة ${user.name || "Renvix"}`, `customer-${crypto.randomBytes(5).toString("hex")}`]);
      tenantId = tenant.rows[0].id;
      await client.query("UPDATE users SET tenant_id=$1 WHERE id=$2", [tenantId, user.id]);
      await client.query("INSERT INTO tenant_members (tenant_id,user_id,role) VALUES ($1,$2,'owner') ON CONFLICT DO NOTHING", [tenantId, user.id]);
    }
    const durationValue = Number(row.duration_value || row.mappingDurationValue || 1);
    const durationUnit = row.duration_unit || row.mappingDurationUnit || "month";
    const quantity = Math.max(1, Number(row.quantity || 1));
    const startsAt = new Date();
    const expiresAt = addDuration(startsAt, durationValue, durationUnit, row.quantityBehavior === "create_multiple_subscriptions" ? 1 : quantity);
    let effectiveExpiresAt = expiresAt;
    await client.query("UPDATE account_provisioning_jobs SET user_id=$2,tenant_id=$3,duration_value=$4,duration_unit=$5,quantity=$6,status='activating_subscription',updated_at=now() WHERE id=$1", [provisioningJobId, user.id, tenantId, durationValue, durationUnit, quantity]);
    const current = await client.query(
      `SELECT id,expires_at AS "expiresAt" FROM tenant_subscriptions
        WHERE tenant_id=$1 AND plan_id=$2 AND status IN ('active','trial')
        ORDER BY expires_at DESC NULLS LAST LIMIT 1 FOR UPDATE`,
      [tenantId, row.plan_id]
    );
    if (current.rows[0] && current.rows[0].id) {
      const renewalBase = current.rows[0].expiresAt && new Date(current.rows[0].expiresAt) > startsAt
        ? new Date(current.rows[0].expiresAt)
        : startsAt;
      const renewedExpiry = addDuration(renewalBase, durationValue, durationUnit, row.quantityBehavior === "create_multiple_subscriptions" ? 1 : quantity);
      effectiveExpiresAt = renewedExpiry;
      await client.query("UPDATE tenant_subscriptions SET expires_at=$2,status='active',updated_at=now() WHERE id=$1", [current.rows[0].id, renewedExpiry]);
    } else {
      await client.query(
        `INSERT INTO tenant_subscriptions (tenant_id,plan_id,source,external_order_id,external_order_item_id,status,starts_at,expires_at)
         VALUES ($1,$2,'salla',$3,$4,'active',$5,$6)
         ON CONFLICT (external_order_id,external_order_item_id) DO UPDATE SET status='active',updated_at=now()`,
        [tenantId, row.plan_id, row.external_order_id, row.external_order_item_id, startsAt, expiresAt]
      );
    }
    const platformSubscription = await client.query(
      "SELECT id FROM platform_subscriptions WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 1 FOR UPDATE",
      [tenantId]
    );
    if (platformSubscription.rows[0]) {
      await client.query(
        "UPDATE platform_subscriptions SET plan_id=$2,status='active',current_period_start=LEAST(current_period_start,$3),current_period_end=GREATEST(current_period_end,$4),updated_at=now() WHERE id=$1",
        [platformSubscription.rows[0].id, row.plan_id, startsAt, effectiveExpiresAt]
      );
    } else {
      await client.query(
        "INSERT INTO platform_subscriptions (tenant_id,plan_id,status,billing_cycle,current_period_start,current_period_end,payment_provider) VALUES ($1,$2,'active',$3,$4,$5,'salla')",
        [tenantId, row.plan_id, durationUnit === "year" ? "yearly" : "monthly", startsAt, effectiveExpiresAt]
      );
    }
    await client.query("UPDATE account_provisioning_jobs SET subscription_activated_at=now(),status=$2,updated_at=now() WHERE id=$1", [provisioningJobId, accountCreated ? "sending_credentials" : "completed"]);
    return { user, tenantId, temporaryPassword, accountCreated };
  });

  if (result.accountCreated && result.temporaryPassword && email) {
    try {
      const sent = await sendQueuedEmail({
        to: email,
        subject: "تم إنشاء حسابك في Renvix",
        text: `مرحبًا ${row.customer_name || ""}،\n\nتم إنشاء حسابك في Renvix بعد تأكيد طلبك.\nالبريد: ${email}\nكلمة المرور المؤقتة: ${result.temporaryPassword}\nرابط الدخول: ${process.env.APP_URL || "https://renvix.app"}/login\n\nسيطلب منك النظام تغيير كلمة المرور عند أول دخول.`
      });
      await markJob(provisioningJobId, { status: "completed", credentials_email_status: "sent", credentials_email_id: sent?.id || sent?.messageId || null, credentials_email_sent_at: new Date() });
    } catch (error) {
      await markJob(provisioningJobId, { status: "email_failed", credentials_email_status: "failed", failure_code: "CREDENTIALS_EMAIL_FAILED", failure_message: String(error?.message || "email_failed").slice(0, 500) });
    }
  }
  return (await query("SELECT * FROM account_provisioning_jobs WHERE id=$1", [provisioningJobId])).rows[0];
}

export async function retryProvisioningCredentials(provisioningJobId) {
  const result = await query(
    `SELECT apj.id,apj.status,apj.customer_name AS "customerName",u.id AS "userId",u.email
       FROM account_provisioning_jobs apj JOIN users u ON u.id=apj.user_id
      WHERE apj.id=$1 AND apj.status='email_failed' LIMIT 1`,
    [provisioningJobId]
  );
  const row = result.rows[0];
  if (!row) return { ok: false, reason: "not_retryable" };
  const temporaryPassword = generateTemporaryPassword();
  await transaction(async (client) => {
    await client.query("UPDATE accounts SET password=$1,updated_at=now() WHERE user_id=$2 AND provider_id='credential'", [await hashPassword(temporaryPassword), row.userId]);
    await client.query("UPDATE users SET must_change_password=true,password_initialized_at=now(),password_changed_at=NULL,updated_at=now() WHERE id=$1", [row.userId]);
    await client.query("UPDATE account_provisioning_jobs SET status='sending_credentials',credentials_email_status='pending',attempts=attempts+1,updated_at=now() WHERE id=$1", [provisioningJobId]);
  });
  try {
    const sent = await sendQueuedEmail({
      to: row.email,
      subject: "بيانات دخول حساب Renvix",
      text: `مرحبًا ${row.customerName || ""}،\n\nتم إصدار كلمة مرور مؤقتة جديدة لحسابك في Renvix.\nالبريد: ${row.email}\nكلمة المرور المؤقتة: ${temporaryPassword}\nرابط الدخول: ${process.env.APP_URL || "https://renvix.app"}/login\n\nسيطلب منك النظام تغيير كلمة المرور عند أول دخول.`
    });
    await markJob(provisioningJobId, { status: "completed", credentials_email_status: "sent", credentials_email_id: sent?.id || sent?.messageId || null, credentials_email_sent_at: new Date(), failure_code: null, failure_message: null });
    return { ok: true };
  } catch (error) {
    await markJob(provisioningJobId, { status: "email_failed", credentials_email_status: "failed", failure_code: "CREDENTIALS_EMAIL_FAILED", failure_message: String(error?.message || "email_failed").slice(0, 500) });
    return { ok: false, reason: "email_failed" };
  }
}
