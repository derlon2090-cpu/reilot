const DAY_MS = 24 * 60 * 60 * 1000;
export const AI_CYCLE_MS = 7 * DAY_MS;
export const AI_MAX_PAID_CYCLES = 4;

export const AI_PLAN_POLICIES = Object.freeze({
  trial: Object.freeze({ weeklyLimit: 100_000, periodCap: 100_000, maxCycles: 1, weeklyRefill: false }),
  retired_free: Object.freeze({ weeklyLimit: 100_000, periodCap: 100_000, maxCycles: 1, weeklyRefill: false }),
  starter: Object.freeze({ weeklyLimit: 1_000_000, periodCap: 4_000_000, maxCycles: 4, weeklyRefill: true }),
  professional: Object.freeze({ weeklyLimit: 3_000_000, periodCap: 12_000_000, maxCycles: 4, weeklyRefill: true }),
  business: Object.freeze({ weeklyLimit: 5_000_000, periodCap: 20_000_000, maxCycles: 4, weeklyRefill: true }),
  enterprise: Object.freeze({ weeklyLimit: 5_000_000, periodCap: 20_000_000, maxCycles: 4, weeklyRefill: true })
});

export function getAIPlanPolicy(planSlug = "trial") {
  return AI_PLAN_POLICIES[String(planSlug)] || AI_PLAN_POLICIES.trial;
}

function validDate(value, label) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError(`${label} must be a valid timestamp`);
  return date;
}

export function buildAIEntitlementCycles({ planSlug, periodStart, periodEnd }) {
  const policy = getAIPlanPolicy(planSlug);
  const start = validDate(periodStart, "periodStart");
  const end = validDate(periodEnd, "periodEnd");
  if (end <= start) throw new RangeError("periodEnd must be after periodStart");
  const count = policy.weeklyRefill ? AI_MAX_PAID_CYCLES : 1;
  return Array.from({ length: count }, (_, index) => {
    const cycleNumber = index + 1;
    const cycleStart = new Date(start.getTime() + index * AI_CYCLE_MS);
    const cycleEnd = policy.weeklyRefill
      ? new Date(cycleStart.getTime() + AI_CYCLE_MS)
      : end;
    return Object.freeze({
      cycleNumber,
      cycleStart,
      cycleEnd,
      accessEndsAt: cycleNumber === count ? end : new Date(Math.min(cycleEnd.getTime(), end.getTime())),
      allowanceTokens: policy.weeklyLimit,
      usedTokens: 0,
      reservedTokens: 0,
      remainingTokens: policy.weeklyLimit
    });
  }).filter((cycle) => cycle.cycleStart < end);
}

export function refillAIToPlanCap(planSlug) {
  const policy = getAIPlanPolicy(planSlug);
  return Object.freeze({
    allowanceTokens: policy.weeklyLimit,
    usedTokens: 0,
    reservedTokens: 0,
    remainingTokens: policy.weeklyLimit
  });
}

export function remainingAITokens(cycle = {}) {
  const allowance = Math.max(0, Number(cycle.allowanceTokens || 0));
  const used = Math.max(0, Number(cycle.usedTokens || 0));
  const reserved = Math.max(0, Number(cycle.reservedTokens || 0));
  return Math.max(0, allowance - used - reserved);
}

export function resolveAIEntitlementCycle({ planSlug, periodStart, periodEnd, now = new Date(), subscriptionActive = true }) {
  const point = validDate(now, "now");
  const start = validDate(periodStart, "periodStart");
  const end = validDate(periodEnd, "periodEnd");
  if (!subscriptionActive || point < start || point >= end) return Object.freeze({ state: "inactive", cycle: null });
  const cycles = buildAIEntitlementCycles({ planSlug, periodStart: start, periodEnd: end });
  const policy = getAIPlanPolicy(planSlug);
  if (!policy.weeklyRefill) return Object.freeze({ state: "active", cycle: cycles[0] });
  const elapsedCycles = Math.floor((point.getTime() - start.getTime()) / AI_CYCLE_MS);
  const cycleIndex = Math.min(AI_MAX_PAID_CYCLES - 1, elapsedCycles);
  const cycle = cycles[cycleIndex];
  return Object.freeze({
    state: elapsedCycles >= AI_MAX_PAID_CYCLES ? "awaiting_subscription_renewal" : "active",
    cycle
  });
}

export function aiUsageWarningLevel(percent = 0) {
  const value = Math.max(0, Math.min(100, Number(percent || 0)));
  if (value >= 100) return "exhausted";
  if (value >= 95) return "critical";
  if (value >= 85) return "warning";
  if (value >= 70) return "notice";
  return "normal";
}
