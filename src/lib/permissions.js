export const ROLE_PERMISSIONS = {
  owner: ["manage:any", "read:any", "create:any", "update:any", "delete:any"],
  admin: ["read:any", "create:any", "update:any", "delete:any"],
  manager: ["read:any", "create:any", "update:any"],
  support: ["read:any", "update:limited"],
  viewer: ["read:any"]
};

export function can(role, action) {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes("manage:any") || permissions.includes(action);
}

export function assertPermission(role, action) {
  if (!can(role, action)) {
    return { ok: false, status: 403, error: "Permission denied" };
  }

  return { ok: true };
}

export function assertTenantAccess(currentTenantId, resourceTenantId) {
  if (!currentTenantId || !resourceTenantId || currentTenantId !== resourceTenantId) {
    return { ok: false, status: 403, error: "Tenant access denied" };
  }

  return { ok: true };
}
