import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { transaction } from "../src/server/db.js";
import { hashPassword } from "../src/server/password.js";
import { classifyPasswordStrength } from "../src/server/security-score.js";
import { isValidEmail, normalizeEmail } from "../src/server/security.js";

function loadLocalBootstrapEnvironment() {
  const file = path.resolve(".env.admin.local");
  if (!fs.existsSync(file)) return;
  for (const rawLine of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^(["'])(.*)\1$/, "$2");
    if (!process.env[key]) process.env[key] = value;
  }
}

loadLocalBootstrapEnvironment();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to create the permanent admin account.");
}

const email = normalizeEmail(process.env.ADMIN_BOOTSTRAP_EMAIL);
const username = String(process.env.ADMIN_BOOTSTRAP_USERNAME || "").trim().toLowerCase();
const password = String(process.env.ADMIN_BOOTSTRAP_PASSWORD || "");
const name = String(process.env.ADMIN_BOOTSTRAP_NAME || "Renvix Admin").trim();

if (!isValidEmail(email)) throw new Error("ADMIN_BOOTSTRAP_EMAIL must be a valid email address.");
if (!/^[a-z][a-z0-9._-]{5,63}$/.test(username)) {
  throw new Error("ADMIN_BOOTSTRAP_USERNAME must be 6-64 characters using letters, numbers, dots, dashes, or underscores.");
}
if (password.length < 20 || classifyPasswordStrength(password, `${username} ${email}`) !== "very_strong") {
  throw new Error("ADMIN_BOOTSTRAP_PASSWORD must be at least 20 characters and classified as very strong.");
}

const passwordHash = await hashPassword(password);
const result = await transaction(async (client) => {
  const usernameOwner = await client.query(
    `SELECT user_id AS "userId" FROM accounts
      WHERE provider_id = 'credential' AND lower(account_id) = $1
      LIMIT 1`,
    [username]
  );
  const existingUser = await client.query(
    "SELECT id FROM users WHERE lower(email) = $1 LIMIT 1",
    [email]
  );
  if (usernameOwner.rows[0] && usernameOwner.rows[0].userId !== existingUser.rows[0]?.id) {
    throw new Error("ADMIN_BOOTSTRAP_USERNAME is already assigned to another account.");
  }

  let userId = existingUser.rows[0]?.id;
  if (userId) {
    await client.query(
      `UPDATE users
          SET name = $2, email_verified = true, role = 'admin',
              password_strength = 'very_strong', password_changed_at = now(), updated_at = now()
        WHERE id = $1`,
      [userId, name]
    );
  } else {
    const createdUser = await client.query(
      `INSERT INTO users
         (tenant_id, name, email, email_verified, role, password_strength, password_changed_at)
       VALUES (NULL, $1, $2, true, 'admin', 'very_strong', now())
       RETURNING id`,
      [name, email]
    );
    userId = createdUser.rows[0].id;
  }

  const credential = await client.query(
    "SELECT id FROM accounts WHERE user_id = $1 AND provider_id = 'credential' ORDER BY created_at LIMIT 1",
    [userId]
  );
  if (credential.rows[0]) {
    await client.query(
      "UPDATE accounts SET account_id = $2, password = $3, updated_at = now() WHERE id = $1",
      [credential.rows[0].id, username, passwordHash]
    );
  } else {
    await client.query(
      `INSERT INTO accounts (user_id, account_id, provider_id, password)
       VALUES ($1, $2, 'credential', $3)`,
      [userId, username, passwordHash]
    );
  }

  const adminResult = await client.query(
    `INSERT INTO admin_users (user_id, role, status, mfa_enabled, expires_at)
     VALUES ($1, 'super_admin', 'active', false, NULL)
     ON CONFLICT (user_id) DO UPDATE SET
       role = 'super_admin', status = 'active', expires_at = NULL, updated_at = now()
     RETURNING id, role, status`,
    [userId]
  );
  const admin = adminResult.rows[0];
  await client.query(
    `INSERT INTO admin_audit_logs
       (admin_user_id, user_id, actor_email, action, resource, status, metadata)
     VALUES ($1, $2, $3, 'admin.permanent.bootstrap', 'admin_users', 'success', $4::jsonb)`,
    [admin.id, userId, email, JSON.stringify({ source: "scripts/bootstrap-admin.mjs", role: admin.role, username })]
  );
  await client.query("DELETE FROM sessions WHERE user_id = $1", [userId]);

  return { userId, adminId: admin.id, role: admin.role, status: admin.status };
});

console.log(JSON.stringify({
  ok: true,
  loginUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://renvix.app"}/advanced-pro-control`,
  username,
  email,
  permanent: true,
  ...result
}, null, 2));
