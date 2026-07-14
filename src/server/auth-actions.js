import crypto from "node:crypto";
import { query, transaction } from "./db.js";
import { hashPassword, verifyPassword } from "./password.js";
import { createSession } from "./session.js";
import { isStrongPassword, normalizeEmail, sha256 } from "./security.js";

function slugify(value) {
  const base = String(value || "store").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${base || "store"}-${crypto.randomBytes(3).toString("hex")}`;
}
export async function registerAccount({ name, companyName, email, password, ipAddress, userAgent }) {
  const normalized = normalizeEmail(email);
  if (!name || String(name).trim().length < 3) return { ok: false, status: 400, reason: "invalid_name" };
  if (!isStrongPassword(password)) return { ok: false, status: 400, reason: "weak_password" };
  const existing = await query("SELECT 1 FROM users WHERE lower(email) = $1", [normalized]);
  if (existing.rowCount) return { ok: false, status: 409, reason: "email_exists" };
  const passwordHash = await hashPassword(password);
  const workspaceName = String(companyName || "").trim() || `متجر ${String(name).trim()}`;

  return transaction(async (client) => {
    const tenant = await client.query(
      "INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING id",
      [workspaceName, slugify(workspaceName)]
    );
    const tenantId = tenant.rows[0].id;
    const user = await client.query(
      `INSERT INTO users (tenant_id, name, email, role)
       VALUES ($1, $2, $3, 'owner') RETURNING id, name, email`,
      [tenantId, String(name).trim(), normalized]
    );
    const userId = user.rows[0].id;
    await client.query(
      `INSERT INTO accounts (user_id, account_id, provider_id, password)
       VALUES ($1, $2, 'credential', $3)`,
      [userId, normalized, passwordHash]
    );
    await client.query("INSERT INTO tenant_members (tenant_id, user_id, role) VALUES ($1, $2, 'owner')", [tenantId, userId]);
    await client.query("INSERT INTO stores (tenant_id, name) VALUES ($1, $2)", [tenantId, workspaceName]);
    await client.query("INSERT INTO settings (tenant_id, language, theme) VALUES ($1, 'ar', 'light')", [tenantId]);
    await client.query("INSERT INTO whatsapp_safety_settings (tenant_id) VALUES ($1)", [tenantId]);
    const plan = await client.query("SELECT id FROM platform_plans WHERE slug = 'trial' OR slug = 'starter' ORDER BY CASE WHEN slug = 'trial' THEN 0 ELSE 1 END LIMIT 1");
    if (plan.rows[0]) {
      await client.query(
        `INSERT INTO platform_subscriptions (tenant_id, plan_id, status, current_period_end)
         VALUES ($1, $2, 'trial', now() + interval '14 days')`,
        [tenantId, plan.rows[0].id]
      );
    }
    await client.query(
      "INSERT INTO activity_logs (tenant_id, user_id, type, title) VALUES ($1, $2, 'auth.registered', 'Account created')",
      [tenantId, userId]
    );
    const session = await createSession(client, { userId, ipAddress, userAgent });
    return { ok: true, status: 201, user: { ...user.rows[0], tenantId, role: "owner" }, session };
  });
}

export async function loginAccount({ email, password, ipAddress, userAgent }) {
  const normalized = normalizeEmail(email);
  const attempts = await query(
    `SELECT count(*)::int AS count FROM login_attempts
      WHERE email = $1 AND success = false AND created_at > now() - interval '15 minutes'`,
    [normalized]
  );
  if (attempts.rows[0].count >= 10) return { ok: false, status: 429, reason: "rate_limited" };

  const result = await query(
    `SELECT u.id, u.tenant_id AS "tenantId", u.name, u.email, COALESCE(tm.role, u.role) AS role, a.password
       FROM users u
       JOIN accounts a ON a.user_id = u.id AND a.provider_id = 'credential'
       LEFT JOIN tenant_members tm ON tm.user_id = u.id AND tm.tenant_id = u.tenant_id
      WHERE lower(u.email) = $1 LIMIT 1`,
    [normalized]
  );
  const user = result.rows[0];
  const valid = user ? await verifyPassword(password, user.password) : false;
  await query(
    `INSERT INTO login_attempts (email, email_hash, ip_address, user_agent, success, failure_reason)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [normalized, sha256(normalized), ipAddress || null, userAgent || null, valid, valid ? null : "invalid_credentials"]
  );
  if (!valid) return { ok: false, status: 401, reason: "invalid_credentials" };

  return transaction(async (client) => {
    const session = await createSession(client, { userId: user.id, ipAddress, userAgent });
    await client.query(
      "INSERT INTO activity_logs (tenant_id, user_id, type, title) VALUES ($1, $2, 'auth.login', 'User signed in')",
      [user.tenantId, user.id]
    );
    const { password: _password, ...safeUser } = user;
    return { ok: true, status: 200, user: safeUser, session };
  });
}
