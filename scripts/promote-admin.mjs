import { query, transaction } from "../src/server/db.js";
import { isValidEmail, normalizeEmail } from "../src/server/security.js";

const email = normalizeEmail(process.argv[2] || process.env.ADMIN_EMAIL);
if (!isValidEmail(email)) {
  throw new Error("Pass an existing user's email as ADMIN_EMAIL or the first argument.");
}

const existing = await query("SELECT id, email FROM users WHERE lower(email) = $1 LIMIT 1", [email]);
if (!existing.rows[0]) {
  throw new Error(`No existing Renvix user was found for ${email}. Create the real user account first.`);
}

const promoted = await transaction(async (client) => {
  const result = await client.query(
    `INSERT INTO admin_users (user_id, role, status, mfa_enabled)
     VALUES ($1, 'super_admin', 'active', false)
     ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin', status = 'active', updated_at = now()
     RETURNING id, user_id AS "userId", role, status`,
    [existing.rows[0].id]
  );
  const admin = result.rows[0];
  await client.query(
    `INSERT INTO admin_audit_logs
       (admin_user_id, user_id, actor_email, action, resource, status, metadata)
     VALUES ($1, $2, $3, 'admin.promoted', 'admin_users', 'success', $4::jsonb)`,
    [admin.id, admin.userId, email, JSON.stringify({ source: "scripts/promote-admin.mjs", role: "super_admin" })]
  );
  return admin;
});

console.log(`Promoted existing Renvix user ${email} to ${promoted.role} (${promoted.status}).`);

