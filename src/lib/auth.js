export function isSessionActive(session, now = new Date()) {
  return Boolean(session?.userId && session?.expiresAt && new Date(session.expiresAt) > now);
}

export function requireSession(session, now = new Date()) {
  return isSessionActive(session, now)
    ? { ok: true, userId: session.userId, tenantId: session.tenantId, role: session.role }
    : { ok: false, status: 401, error: "Authentication required" };
}

export function loginFailureMessage() {
  return "Invalid email or password";
}

export function createRegistrationArtifacts({ userId, tenantId, storeId, planId, now = new Date() }) {
  const month = now.getUTCMonth() + 1;
  const year = now.getUTCFullYear();

  return {
    user: { id: userId, tenantId },
    tenant: { id: tenantId, status: "trial" },
    store: { id: storeId, tenantId },
    tenantMember: { tenantId, userId, role: "owner", status: "active" },
    platformSubscription: { tenantId, planId, status: "trial" },
    settings: { tenantId, language: "ar", theme: "light" },
    notificationTemplates: [
      { tenantId, triggerType: "before_expiry", daysOffset: 7 },
      { tenantId, triggerType: "before_expiry", daysOffset: 3 },
      { tenantId, triggerType: "on_expiry", daysOffset: 0 }
    ],
    automationRules: [
      { tenantId, triggerType: "before_expiry", daysOffset: 7, isActive: true },
      { tenantId, triggerType: "before_expiry", daysOffset: 3, isActive: true },
      { tenantId, triggerType: "on_expiry", daysOffset: 0, isActive: true }
    ],
    messageUsage: { tenantId, month, year, usedMessages: 0, messageLimit: 50 }
  };
}
