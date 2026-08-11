import { randomBytes } from "node:crypto";
import { query, transaction } from "./db.js";
import { assertPlanCapacity } from "./plan-entitlements.js";
import { validateOptionalEmail } from "../lib/customerValidation.js";

function publicId() {
  return `nl_${randomBytes(18).toString("base64url")}`;
}

export async function getOrCreateNewsletterProfile(tenantId, ownerUserId) {
  return transaction(async (client) => {
    const result = await client.query(
      `INSERT INTO newsletter_profiles (tenant_id, owner_user_id, public_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id) DO UPDATE SET
         owner_user_id = COALESCE(newsletter_profiles.owner_user_id, EXCLUDED.owner_user_id),
         updated_at = now()
       RETURNING id, public_id AS "publicId", is_active AS "isActive"`,
      [tenantId, ownerUserId, publicId()]
    );
    return result.rows[0];
  });
}

export async function getPublicNewsletterProfile(profilePublicId, runner = { query }) {
  const result = await runner.query(
    `SELECT np.id, np.public_id AS "publicId", np.tenant_id AS "tenantId",
            np.owner_user_id AS "ownerUserId",
            COALESCE(NULLIF(st.name, ''), NULLIF(t.name, ''), 'Renvix') AS "displayName"
       FROM newsletter_profiles np
       JOIN tenants t ON t.id = np.tenant_id
       LEFT JOIN LATERAL (
         SELECT name FROM stores WHERE tenant_id = np.tenant_id ORDER BY created_at LIMIT 1
       ) st ON true
      WHERE np.public_id = $1 AND np.is_active = true
      LIMIT 1`,
    [String(profilePublicId || "")]
  );
  return result.rows[0] || null;
}

function subscriberName(email) {
  const localPart = email.split("@")[0].replace(/[._-]+/g, " ").trim();
  return localPart.length >= 2 ? localPart.slice(0, 80) : "مشترك النشرة";
}

export async function subscribeToNewsletter(profilePublicId, rawEmail) {
  const emailResult = validateOptionalEmail(rawEmail);
  if (!emailResult.ok || !emailResult.email) {
    throw Object.assign(new Error("أدخل بريدًا إلكترونيًا صحيحًا."), { status: 400, reason: "invalid_email" });
  }

  return transaction(async (client) => {
    const profile = await getPublicNewsletterProfile(profilePublicId, client);
    if (!profile) throw Object.assign(new Error("رابط النشرة غير صالح أو لم يعد متاحًا."), { status: 404, reason: "newsletter_not_found" });

    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`newsletter:${profile.id}:${emailResult.email}`]);
    const existingSubscription = await client.query(
      `SELECT customer_id AS "customerId" FROM newsletter_subscribers
        WHERE profile_id = $1 AND email_normalized = $2 LIMIT 1`,
      [profile.id, emailResult.email]
    );
    if (existingSubscription.rows[0]) {
      return { customerId: existingSubscription.rows[0].customerId, alreadySubscribed: true, displayName: profile.displayName };
    }

    let customer = await client.query(
      `SELECT id FROM customers
        WHERE tenant_id = $1 AND lower(email) = $2
        ORDER BY created_at LIMIT 1`,
      [profile.tenantId, emailResult.email]
    );

    if (!customer.rows[0]) {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`plan-customers:${profile.tenantId}`]);
      await assertPlanCapacity(profile.tenantId, "customers", client);
      customer = await client.query(
        `INSERT INTO customers (tenant_id, name, email, status, tags)
         VALUES ($1, $2, $3, 'active', '["newsletter"]'::jsonb)
         RETURNING id`,
        [profile.tenantId, subscriberName(emailResult.email), emailResult.email]
      );
    } else {
      await client.query(
        `UPDATE customers
            SET status = 'active',
                tags = CASE
                  WHEN COALESCE(tags, '[]'::jsonb) @> '["newsletter"]'::jsonb THEN COALESCE(tags, '[]'::jsonb)
                  ELSE COALESCE(tags, '[]'::jsonb) || '["newsletter"]'::jsonb
                END,
                updated_at = now()
          WHERE id = $1 AND tenant_id = $2`,
        [customer.rows[0].id, profile.tenantId]
      );
    }

    await client.query(
      `INSERT INTO newsletter_subscribers (profile_id, customer_id, email_normalized)
       VALUES ($1, $2, $3)
       ON CONFLICT (profile_id, email_normalized) DO NOTHING`,
      [profile.id, customer.rows[0].id, emailResult.email]
    );
    await client.query(
      `INSERT INTO activity_logs (tenant_id, user_id, customer_id, type, title, metadata)
       VALUES ($1, $2, $3, 'newsletter.subscribed', 'Newsletter subscriber added', $4::jsonb)`,
      [profile.tenantId, profile.ownerUserId, customer.rows[0].id, JSON.stringify({ source: "public_newsletter", email: emailResult.email })]
    );
    return { customerId: customer.rows[0].id, alreadySubscribed: false, displayName: profile.displayName };
  });
}
