import { canSendSafely } from "./messageSafety.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function daysUntil(date, now) {
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const end = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.round((end - start) / DAY_MS);
}

export function queueRenewalReminders({ tenants, subscriptions, automationRules, unsubscribeList, existingQueue, now = new Date() }) {
  const activeTenantIds = new Set(tenants.filter((tenant) => tenant.status !== "inactive").map((tenant) => tenant.id));
  const activeOffsets = new Set(automationRules.filter((rule) => rule.isActive).map((rule) => rule.daysOffset));
  const unsubscribed = new Set(unsubscribeList.map((entry) => `${entry.tenantId}:${entry.customerId}`));
  const existingKeys = new Set(existingQueue.map((item) => item.triggerKey));
  const queued = [];

  for (const subscription of subscriptions) {
    const offset = daysUntil(new Date(subscription.endDate), now);
    const triggerKey = `${subscription.tenantId}:${subscription.id}:renewal:${offset}`;

    if (!activeTenantIds.has(subscription.tenantId)) continue;
    if (!activeOffsets.has(offset)) continue;
    if (unsubscribed.has(`${subscription.tenantId}:${subscription.customerId}`)) continue;
    if (existingKeys.has(triggerKey)) continue;

    queued.push({
      tenantId: subscription.tenantId,
      subscriptionId: subscription.id,
      customerId: subscription.customerId,
      status: "pending",
      triggerKey
    });
    existingKeys.add(triggerKey);
  }

  return queued;
}

export async function processMessageRetry({ queue, send, safetyByTenant, now = new Date() }) {
  const processed = [];

  for (const item of queue.filter((entry) => entry.status === "pending")) {
    const safety = canSendSafely({ ...safetyByTenant[item.tenantId], now });
    if (!safety.ok) {
      processed.push({ ...item, status: "pending", skippedReason: safety.reason });
      continue;
    }

    const result = await send(item);
    processed.push(
      result.ok
        ? { ...item, status: "sent", providerMessageId: result.providerMessageId }
        : { ...item, attempts: item.attempts + 1, status: item.attempts + 1 >= item.maxAttempts ? "failed" : "pending", lastError: result.error }
    );
  }

  return processed;
}

export function resetMonthlyUsage({ tenants, planByTenant, existingUsage, now = new Date() }) {
  const month = now.getUTCMonth() + 1;
  const year = now.getUTCFullYear();
  const existingKeys = new Set(existingUsage.map((entry) => `${entry.tenantId}:${entry.month}:${entry.year}`));

  return tenants
    .filter((tenant) => !existingKeys.has(`${tenant.id}:${month}:${year}`))
    .map((tenant) => ({
      tenantId: tenant.id,
      month,
      year,
      usedMessages: 0,
      messageLimit: planByTenant[tenant.id].messages
    }));
}

export function cleanupExpiredData({ qrCache, queue, now = new Date() }) {
  return {
    qrCache: qrCache.filter((item) => new Date(item.expiresAt) > now),
    queue: queue.filter((item) => !(item.status === "sent" && new Date(item.updatedAt) < new Date(now.getTime() - 30 * DAY_MS)))
  };
}
