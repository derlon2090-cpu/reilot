import crypto from "node:crypto";
import { z } from "zod";
import { transaction } from "../../../../src/server/db.js";
import { hashPassword } from "../../../../src/server/password.js";
import { safeErrorMessage } from "../../../../src/server/security.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RECOVERY_TOKEN_DIGEST = "75a2d37d7f033be9173010fc2cd342cbfbcb07b6e4134d46cc458ea1745a125b";
const RECOVERY_ACTION = "admin.emergency_recovery.2026_07_29";
const TARGET_EMAIL = "renvix.app@gmail.com";

const inputSchema = z.object({
  email: z.literal(TARGET_EMAIL),
  username: z.literal("waleed_ali"),
  name: z.literal("waleed ali"),
  password: z.string()
    .min(20)
    .regex(/[A-Z]/)
    .regex(/[a-z]/)
    .regex(/[0-9]/)
    .regex(/[^A-Za-z0-9]/)
});

function tokenIsValid(rawToken) {
  const supplied = crypto.createHash("sha256").update(String(rawToken || "")).digest();
  const expected = Buffer.from(RECOVERY_TOKEN_DIGEST, "hex");
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}

function json(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow"
    }
  });
}

export async function POST(request) {
  if (!tokenIsValid(request.headers.get("x-admin-recovery-token"))) {
    return json({ ok: false, reason: "not_found" }, 404);
  }

  const parsed = inputSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return json({ ok: false, reason: "invalid_recovery_input" }, 400);

  try {
    const passwordHash = await hashPassword(parsed.data.password);
    const recovered = await transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [RECOVERY_ACTION]);

      const consumed = await client.query(
        "SELECT 1 FROM admin_audit_logs WHERE action = $1 LIMIT 1",
        [RECOVERY_ACTION]
      );
      if (consumed.rows[0]) return { alreadyRecovered: true };

      const userResult = await client.query(
        "SELECT id FROM users WHERE lower(email) = lower($1) FOR UPDATE",
        [TARGET_EMAIL]
      );
      const userId = userResult.rows[0]?.id;
      if (!userId) return { accountMissing: true };

      const usernameOwner = await client.query(
        `SELECT user_id AS "userId"
           FROM accounts
          WHERE provider_id = 'credential' AND lower(account_id) = lower($1)
          LIMIT 1`,
        [parsed.data.username]
      );
      if (usernameOwner.rows[0] && usernameOwner.rows[0].userId !== userId) {
        return { usernameConflict: true };
      }

      await client.query(
        `UPDATE users
            SET name = $2, email_verified = true, role = 'admin',
                password_strength = 'very_strong', password_changed_at = now(), updated_at = now()
          WHERE id = $1`,
        [userId, parsed.data.name]
      );

      const credential = await client.query(
        `SELECT id FROM accounts
          WHERE user_id = $1 AND provider_id = 'credential'
          ORDER BY created_at
          LIMIT 1`,
        [userId]
      );
      if (credential.rows[0]) {
        await client.query(
          "UPDATE accounts SET account_id = $2, password = $3, updated_at = now() WHERE id = $1",
          [credential.rows[0].id, parsed.data.username, passwordHash]
        );
      } else {
        await client.query(
          `INSERT INTO accounts (user_id, account_id, provider_id, password)
           VALUES ($1, $2, 'credential', $3)`,
          [userId, parsed.data.username, passwordHash]
        );
      }

      const adminResult = await client.query(
        `INSERT INTO admin_users (user_id, role, status, mfa_enabled, expires_at)
         VALUES ($1, 'super_admin', 'active', false, NULL)
         ON CONFLICT (user_id) DO UPDATE SET
           role = 'super_admin',
           status = 'active',
           mfa_enabled = false,
           expires_at = NULL,
           updated_at = now()
         RETURNING id`,
        [userId]
      );
      const adminId = adminResult.rows[0].id;

      await client.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
      await client.query(
        "DELETE FROM login_attempts WHERE lower(email) IN (lower($1), lower($2))",
        [TARGET_EMAIL, parsed.data.username]
      );
      await client.query(
        `INSERT INTO admin_audit_logs
           (admin_user_id, user_id, actor_email, action, resource, status, metadata)
         VALUES ($1, $2, $3, $4, 'admin_users', 'success', $5::jsonb)`,
        [
          adminId,
          userId,
          TARGET_EMAIL,
          RECOVERY_ACTION,
          JSON.stringify({ source: "one_time_recovery", username: parsed.data.username })
        ]
      );

      return { ok: true };
    });

    if (recovered.alreadyRecovered) return json({ ok: false, reason: "recovery_consumed" }, 410);
    if (recovered.accountMissing) return json({ ok: false, reason: "target_account_missing" }, 404);
    if (recovered.usernameConflict) return json({ ok: false, reason: "username_conflict" }, 409);
    return json({ ok: true, message: "Admin credentials recovered." });
  } catch (error) {
    console.error("admin emergency recovery unavailable", safeErrorMessage(error));
    return json({ ok: false, reason: "recovery_unavailable" }, 503);
  }
}
