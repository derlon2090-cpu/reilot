const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function riyadhToday(now = new Date()) {
  return new Date(now.getTime() + RIYADH_OFFSET_MS).toISOString().slice(0, 10);
}

function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
}

export function defaultAdminPlanPeriod(now = new Date()) {
  const startDate = riyadhToday(now);
  const start = parseDate(startDate);
  const nextMonthLastDay = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 2, 0)).getUTCDate();
  const nextAnniversary = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1,
    Math.min(start.getUTCDate(), nextMonthLastDay)));
  return { startDate, endDate: new Date(nextAnniversary.getTime() - DAY_MS).toISOString().slice(0, 10) };
}

export function parseAdminPlanPeriod(startDate, endDate, now = new Date()) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end || end < start) return { ok: false, reason: "invalid_plan_period" };
  const today = riyadhToday(now);
  if (startDate > today) return { ok: false, reason: "plan_period_start_future" };
  if (endDate < today) return { ok: false, reason: "plan_period_not_active" };
  return {
    ok: true,
    periodStart: new Date(start.getTime() - RIYADH_OFFSET_MS),
    periodEnd: new Date(end.getTime() + DAY_MS - RIYADH_OFFSET_MS)
  };
}
