import fs from "node:fs";
import path from "node:path";
import { transaction } from "../src/server/db.js";
import { hashPassword } from "../src/server/password.js";
import { isStrongPassword, isValidEmail, normalizeEmail } from "../src/server/security.js";

function loadLocalEnvironment() {
  const filePath = path.join(process.cwd(), ".env.admin.local");
  if (!fs.existsSync(filePath)) return;

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const value = line.trim();
    if (!value || value.startsWith("#")) continue;
    const separator = value.indexOf("=");
    if (separator < 1) continue;
    const key = value.slice(0, separator).trim();
    const raw = value.slice(separator + 1).trim();
    if (!process.env[key]) {
      process.env[key] = raw.replace(/^(['"])(.*)\1$/, "$2");
    }
  }
}

loadLocalEnvironment();

const email = normalizeEmail(process.env.ADMIN_BOOTSTRAP_EMAIL);
const password = String(process.env.ADMIN_BOOTSTRAP_PASSWORD || "");
const name = String(process.env.ADMIN_BOOTSTRAP_NAME || "Renvix Admin").trim();
const controlPath = String(process.env.ADMIN_CONTROL_PATH || "").trim().replace(/^\/+|\/+$/g, "");

if (!isValidEmail(email)) {
  throw new Error("ADMIN_BOOTSTRAP_EMAIL must be a valid email address.");
}
if (!isStrongPassword(password) || password.length < 16) {
  throw new Error("ADMIN_BOOTSTRAP_PASSWORD must be at least 16 characters and include letters, numbers, and symbols.");
}
if (!/^[a-zA-Z0-9_-]{32,}$/.test(controlPath)) {
  throw new Error("ADMIN_CONTROL_PATH must contain at least 32 letters, numbers, underscores, or dashes.");
}

const passwordHash = await hashPassword(password);

const admin = await transaction(async (client) => {
  const existing = await client.query(
    "SELECT id FROM users WHERE lower(email) = $1 LIMIT 1",
    [email]
  );

  let userId = existing.rows[0]?.id;
  if (userId) {
    await client.query(
      "UPDATE users SET name = $2, updated_at = now() WHERE id = $1",
      [userId, name]
    );
  } else {
    const created = await client.query(
      `INSERT INTO users (tenant_id, name, email, email_verified, role)
       VALUES (NULL, $1, $2, true, 'admin')
       RETURNING id`,
      [name, email]
    );
    userId = created.rows[0].id;
  }

  const account = await client.query(
    `SELECT id FROM accounts
      WHERE user_id = $1 AND provider_id = 'credential'
      LIMIT 1`,
    [userId]
  );
  if (account.rows[0]) {
    await client.query(
      `UPDATE accounts
          SET account_id = $2, password = $3, updated_at = now()
        WHERE id = $1`,
      [account.rows[0].id, email, passwordHash]
    );
  } else {
    await client.query(
      `INSERT INTO accounts (user_id, account_id, provider_id, password)
       VALUES ($1, $2, 'credential', $3)`,
      [userId, email, passwordHash]
    );
  }

  const result = await client.query(
    `INSERT INTO admin_users (user_id, role, status, mfa_enabled)
     VALUES ($1, 'super_admin', 'active', false)
     ON CONFLICT (user_id) DO UPDATE
       SET role = 'super_admin', status = 'active', updated_at = now()
     RETURNING id, role, status`,
    [userId]
  );

  return { userId, ...result.rows[0] };
});

console.log(`Renvix admin account is ready for ${email}.`);
console.log(`Role: ${admin.role}; status: ${admin.status}.`);
console.log("Password and control path were not printed.");
