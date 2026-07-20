import crypto from "node:crypto";
import { query, transaction } from "../src/server/db.js";
import { hashPassword } from "../src/server/password.js";
import { classifyPasswordStrength } from "../src/server/security-score.js";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required to create a real temporary admin.");

const hours = Math.min(168, Math.max(1, Number(process.env.TEMP_ADMIN_HOURS || process.argv[2] || 24)));
const suffix = Date.now().toString(36);
const email = `temporary-admin-${suffix}@renvix.app`;
const password = `Rv!${crypto.randomBytes(15).toString("base64url")}9a`;
const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

const result = await transaction(async (client) => {
  const user = await client.query(
    `INSERT INTO users (tenant_id, name, email, role, email_verified, password_strength, password_changed_at)
     VALUES (NULL, 'مدير مؤقت', $1, 'admin', true, $2, now())
     RETURNING id`,
    [email, classifyPasswordStrength(password, email)]
  );
  const userId = user.rows[0].id;
  await client.query(
    `INSERT INTO accounts (user_id, account_id, provider_id, password)
     VALUES ($1, $2, 'credential', $3)`,
    [userId, email, await hashPassword(password)]
  );
  const admin = await client.query(
    `INSERT INTO admin_users (user_id, role, status, mfa_enabled, expires_at)
     VALUES ($1, 'viewer', 'active', false, $2)
     RETURNING id`,
    [userId, expiresAt]
  );
  await client.query(
    `INSERT INTO admin_audit_logs
       (admin_user_id, user_id, actor_email, action, resource, status, metadata)
     VALUES ($1, $2, $3, 'admin.temporary.created', 'admin_users', 'success', $4::jsonb)`,
    [admin.rows[0].id, userId, email, JSON.stringify({ expiresAt: expiresAt.toISOString(), hours, role: "viewer" })]
  );
  return { userId, adminId: admin.rows[0].id };
});

await query("DELETE FROM sessions WHERE user_id IN (SELECT user_id FROM admin_users WHERE expires_at IS NOT NULL AND expires_at <= now())");

console.log(JSON.stringify({
  ok: true,
  loginUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://renvix.app"}/advanced-pro-control`,
  email,
  password,
  role: "viewer",
  expiresAt: expiresAt.toISOString(),
  ...result
}, null, 2));
