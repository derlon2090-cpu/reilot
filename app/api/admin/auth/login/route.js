import { z } from "zod";
import { auditAdmin, requestIp } from "../../../../../src/server/admin-auth.js";
import { query, transaction } from "../../../../../src/server/db.js";
import { verifyPassword } from "../../../../../src/server/password.js";
import { isValidEmail, normalizeEmail, sha256 } from "../../../../../src/server/security.js";
import { createSession, destroySession, sessionCookie } from "../../../../../src/server/session.js";

const loginSchema = z.object({
  email: z.string().trim().min(1, "يرجى إدخال البريد الإلكتروني.").refine(isValidEmail, "يرجى إدخال بريد إلكتروني صحيح."),
  password: z.string().min(1, "يرجى إدخال كلمة المرور."),
  rememberMe: z.boolean().optional().default(false)
});

export async function POST(request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ ok: false, reason: "validation_error", errors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const email = normalizeEmail(parsed.data.email);
  const ip = requestIp(request);
  const failures = await query(
    `SELECT count(*)::int AS count FROM login_attempts
      WHERE success = false AND created_at > now() - interval '15 minutes'
        AND (email = $1 OR ($2 <> '' AND ip_address = $2))`,
    [email, ip]
  );
  if (failures.rows[0].count >= 5) {
    return Response.json({ ok: false, reason: "rate_limited", message: "تم تجاوز عدد محاولات الدخول. حاول مرة أخرى لاحقًا." }, { status: 429 });
  }

  const result = await query(
    `SELECT u.id AS "userId", u.name, u.email, a.password,
            au.id AS "adminId", au.role AS "adminRole", au.status,
            au.mfa_enabled AS "mfaEnabled"
       FROM users u
       JOIN accounts a ON a.user_id = u.id AND a.provider_id = 'credential'
       LEFT JOIN admin_users au ON au.user_id = u.id
      WHERE lower(u.email) = $1 LIMIT 1`,
    [email]
  );
  const admin = result.rows[0];
  const passwordValid = admin ? await verifyPassword(parsed.data.password, admin.password) : false;
  const allowedRole = ["super_admin", "admin", "support_admin", "billing_admin", "security_admin", "viewer"].includes(admin?.adminRole);
  const valid = passwordValid && admin?.adminId && admin.status === "active" && allowedRole;

  await query(
    `INSERT INTO login_attempts (email, email_hash, ip_address, user_agent, success, failure_reason)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [email, sha256(email), ip || null, request.headers.get("user-agent")?.slice(0, 500) || null, Boolean(valid), valid ? null : "invalid_admin_credentials"]
  );

  if (!valid) {
    await auditAdmin(request, {
      userId: admin?.userId || null,
      action: "admin.login.failed",
      resource: "admin_portal",
      status: "failed",
      metadata: { reason: passwordValid && admin?.status === "disabled" ? "disabled" : "invalid_credentials", actorEmail: email }
    });
    if (passwordValid && admin?.status === "disabled") {
      return Response.json({ ok: false, reason: "admin_disabled", message: "تم تعطيل حساب الأدمن. تواصل مع المسؤول الأعلى." }, { status: 403 });
    }
    return Response.json({ ok: false, reason: "invalid_credentials", message: "بيانات الدخول غير صحيحة أو لا تملك صلاحية الوصول إلى لوحة الأدمن." }, { status: 401 });
  }

  if (admin.mfaEnabled) {
    await auditAdmin(request, { admin, action: "admin.login.failed", resource: "admin_portal", status: "denied", metadata: { reason: "mfa_required" } });
    return Response.json({ ok: false, reason: "mfa_required", message: "يتطلب هذا الحساب إكمال المصادقة الثنائية." }, { status: 403 });
  }

  await destroySession(request);
  const maxAgeSeconds = parsed.data.rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 12;
  const session = await transaction(async (client) => {
    const created = await createSession(client, { userId: admin.userId, ipAddress: ip, userAgent: request.headers.get("user-agent"), maxAgeSeconds });
    await client.query(
      "UPDATE admin_users SET last_login_at = now(), last_login_ip = $2, updated_at = now() WHERE id = $1",
      [admin.adminId, ip || null]
    );
    return created;
  });
  await auditAdmin(request, { admin, action: "admin.login.success", resource: "admin_portal", metadata: { role: admin.adminRole } });
  return Response.json({
    ok: true,
    redirectUrl: "/admin",
    admin: { name: admin.name, email: admin.email, role: admin.adminRole }
  }, { headers: { "Set-Cookie": sessionCookie(session.token, parsed.data.rememberMe ? maxAgeSeconds : null) } });
}
