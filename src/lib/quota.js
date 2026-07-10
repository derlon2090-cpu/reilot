export const PLAN_LIMITS = {
  trial: { whatsappChannels: 1, messages: 50, customers: 20 },
  starter: { whatsappChannels: 1, messages: 500, customers: 300 },
  pro: { whatsappChannels: 1, messages: 3000, customers: 1500 },
  business: { whatsappChannels: 2, messages: 10000, customers: 5000 }
};

export function getPlanLimits(plan = "trial") {
  const key = String(plan).toLowerCase();
  if (!PLAN_LIMITS[key]) {
    throw new Error(`Unknown plan: ${plan}`);
  }

  return PLAN_LIMITS[key];
}

export function canAddCustomer(plan, currentCustomers) {
  const limits = getPlanLimits(plan);
  return currentCustomers < limits.customers;
}

export function canCreateWhatsappChannel(plan, currentChannels) {
  const limits = getPlanLimits(plan);
  return currentChannels < limits.whatsappChannels;
}

export function canSendPlanMessage(plan, usedMessages, extraMessages = 0) {
  const limits = getPlanLimits(plan);
  return usedMessages < limits.messages + extraMessages;
}

export function recordMessageUsage(usage, sendResult) {
  if (!sendResult?.ok) return { ...usage };
  return { ...usage, usedMessages: usage.usedMessages + 1 };
}

export function createMonthlyUsage(tenantId, plan, date = new Date()) {
  const limits = getPlanLimits(plan);
  return {
    tenantId,
    month: date.getUTCMonth() + 1,
    year: date.getUTCFullYear(),
    usedMessages: 0,
    messageLimit: limits.messages
  };
}
