import { query } from "./db.js";
import { getSession } from "./session.js";
import { safeErrorMessage, sha256 } from "./security.js";

const ROLE_PERMISSIONS = {
  super_admin: { "*": ["*"] },
  admin: {
    overview: ["read"],
    subscriptions: ["read", "update"],
    customers: ["read", "update"],
    devices: ["read", "update"],
    security: ["read"],
    reports: ["read", "export"],
    audit: ["read"]
  },
  support_admin: {
    overview: ["read"],
    customers: ["read"],
    devices: ["read", "update"],
    audit: ["read"]
  },
  billing_admin: {
    overview: ["read"],
    subscriptions: ["read", "update"],
    reports: ["read", "export"]
  },
  security_admin: {
    overview: ["read"],
    devices: ["read", "update"],
    security: ["read", "update"],
    audit: ["read"]
  },
  viewer: {
    overview: ["read"],
    subscriptions: ["read"],
    customers: ["read"],
    devices: ["read"],
    security: ["read"],
    reports: ["read"],
    audit: ["read"]
  }
};

function hasRolePermission(role, module, action) {
  const permissions = ROLE_PERMISSIONS[role] || {};
  return permissions["*"]?.includes("*")
    || permissions[module]?.includes("*")
    || permissions[module]?.includes(action)
    || false;
}

export function adminControlPath() {
  return "advanced-pro-control";
}

export function requestIp(req) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || "";
}

export async function getAdminContext(req) {
  const session = await getSession(req);
  if (!session) return null;

  const result = await query(
      `SELECT au.id AS "adminId", au.role AS "adminRole", au.status,
            au.mfa_enabled AS "mfaEnabled", au.expires_at AS "expiresAt", u.id AS "userId",
            u.name, u.email
       FROM admin_users au
       JOIN users u ON u.id = au.user_id
      WHERE au.user_id = $1 AND au.status = 'active'
        AND (au.expires_at IS NULL OR au.expires_at > now())
      LIMIT 1`,
    [session.userId]
  );
  const admin = result.rows[0];
  if (!admin) return null;

  const overrides = await query(
    `SELECT module, action, allowed
       FROM admin_permissions
      WHERE admin_user_id = $1`,
    [admin.adminId]
  );

  return {
    ...admin,
    sessionId: session.id,
    permissions: overrides.rows
  };
}

export function adminCan(admin, module, action = "read") {
  if (!admin) return false;
  const override = admin.permissions?.find((item) => item.module === module && item.action === action);
  if (override) return override.allowed;
  return hasRolePermission(admin.adminRole, module, action);
}

export async function auditAdmin(req, {
  admin = null,
  userId = null,
  action,
  resource = null,
  status = "success",
  metadata = {}
}) {
  try {
    await query(
      `INSERT INTO admin_audit_logs
         (admin_user_id, user_id, actor_email, action, resource, status, metadata, ip_hash, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)`,
      [
        admin?.adminId || null,
        admin?.userId || userId || null,
        admin?.email || metadata?.actorEmail || null,
        action,
        resource,
        status,
        JSON.stringify(metadata || {}),
        requestIp(req) ? sha256(requestIp(req)) : null,
        requestIp(req) || null,
        req.headers.get("user-agent")?.slice(0, 500) || null
      ]
    );
  } catch (error) {
    console.error("admin audit failed", safeErrorMessage(error));
  }
}

export async function requireAdminPermission(req, module, action = "read") {
  const admin = await getAdminContext(req);
  if (!admin) {
    await auditAdmin(req, { action: "admin.access.denied", resource: module, status: "denied" });
    return {
      ok: false,
      response: Response.json({ ok: false, reason: "admin_auth_required" }, { status: 401 })
    };
  }
  if (!adminCan(admin, module, action)) {
    await auditAdmin(req, { admin, action: "admin.permission", resource: `${module}:${action}`, status: "denied" });
    return {
      ok: false,
      response: Response.json({ ok: false, reason: "admin_permission_denied" }, { status: 403 })
    };
  }
  return { ok: true, admin };
}
