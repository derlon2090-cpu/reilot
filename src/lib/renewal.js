export function renewedEndDate(currentEndDate, duration, customDate) {
  if (duration === "custom") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(customDate || ""))) throw new Error("Invalid custom date");
    return customDate;
  }
  const months = { month: 1, three_months: 3, six_months: 6, year: 12 }[duration];
  if (!months) throw new Error("Invalid renewal duration");
  const base = new Date(`${currentEndDate}T12:00:00Z`);
  if (Number.isNaN(base.valueOf())) throw new Error("Invalid end date");
  const originalDay = base.getUTCDate();
  base.setUTCDate(1);
  base.setUTCMonth(base.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
  base.setUTCDate(Math.min(originalDay, lastDay));
  return base.toISOString().slice(0, 10);
}
