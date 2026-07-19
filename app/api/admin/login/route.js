import crypto from "node:crypto";
import { auditAdmin, adminControlPath, requestIp } from "../../../../src/server/admin-auth.js";
import { query, transaction } from "../../../../src/server/db.js";
import { verifyPassword } from "../../../../src/server/password.js";
import { normalizeEmail, sha256 } from "../../../../src/server/security.js";
import { createSession, sessionCookie } from "../../../../src/server/session.js";

function pathMatches(value) {
  const expected = adminControlPath();
  const actual = String(value || "").replace(/^\/+|\/+$/g, "");
  if (!expected || expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  if (!pathMatches(body.controlPath)) {
    await auditAdmin(request, {
      action: "admin.login",
      resource: "admin_portal",
      status: "denied",
      metadata: { reason: "invalid_control_path" }
    });
    return Response.json({ ok: false, reason: "invalid_credentials" }, { status: 401 });
  }

  const email = normalizeEmail(body.email);
  const recentFailures = await query(
    `SELECT count(*)::int AS count
       FROM login_attempts
      WHERE email = $1
        AND success = false
        AND created_at > now() - interval '15 minutes'`,
    [email]
  );
  if (recentFailures.rows[0].count >= 5) {
    return Response.json({ ok: false, reason: "rate_limited" }, { status: 429 });
  }

  const result = await query(
    `SELECT u.id AS "userId", u.name, u.email, a.password,
            au.id AS "adminId", au.role AS "adminRole",
            au.status, au.mfa_enabled AS "mfaEnabled"
       FROM users u
       JOIN accounts a
         ON a.user_id = u.id AND a.provider_id = 'credential'
       JOIN admin_users au
         ON au.user_id = u.id AND au.status = 'active'
      WHERE lower(u.email) = $1
      LIMIT 1`,
    [email]
  );
  const admin = result.rows[0];
  const valid = admin ? await verifyPassword(body.password, admin.password) : false;

  await query(
    `INSERT INTO login_attempts
       (email, email_hash, ip_address, user_agent, success, failure_reason)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      email,
      sha256(email),
      requestIp(request) || null,
      request.headers.get("user-agent")?.slice(0, 500) || null,
      valid,
      valid ? null : "invalid_admin_credentials"
    ]
  );

  if (!valid) {
    await auditAdmin(request, {
      userId: admin?.userId || null,
      action: "admin.login",
      resource: "admin_portal",
      status: "failed",
      metadata: { reason: "invalid_credentials" }
    });
    return Response.json({ ok: false, reason: "invalid_credentials" }, { status: 401 });
  }

  if (admin.mfaEnabled) {
    await auditAdmin(request, {
      admin,
      action: "admin.login",
      resource: "admin_portal",
      status: "denied",
      metadata: { reason: "mfa_required" }
    });
    return Response.json({ ok: false, reason: "mfa_required" }, { status: 403 });
  }

  const session = await transaction(async (client) => {
    const created = await createSession(client, {
      userId: admin.userId,
      ipAddress: requestIp(request),
      userAgent: request.headers.get("user-agent")
    });
    await client.query(
      "UPDATE admin_users SET last_login_at = now(), updated_at = now() WHERE id = $1",
      [admin.adminId]
    );
    return created;
  });

  await auditAdmin(request, {
    admin,
    action: "admin.login",
    resource: "admin_portal",
    metadata: { role: admin.adminRole }
  });

  return Response.json(
    {
      ok: true,
      admin: { name: admin.name, email: admin.email, role: admin.adminRole }
    },
    { headers: { "Set-Cookie": sessionCookie(session.token) } }
  );
}
