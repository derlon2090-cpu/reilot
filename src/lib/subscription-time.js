const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

function asDate(value) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("INVALID_SUBSCRIPTION_DATES");
  return date;
}

export function calculateRemainingTime({ startsAt, expiresAt, now = new Date() }) {
  const start = asDate(startsAt).getTime();
  const expiry = asDate(expiresAt).getTime();
  const current = asDate(now).getTime();
  if (expiry <= start) throw new Error("INVALID_SUBSCRIPTION_DATES");
  const totalMs = expiry - start;
  if (current < start) return { status:"pending",remainingMs:totalMs,remainingDays:Math.ceil(totalMs/DAY_MS),remainingHours:0,remainingMinutes:0,progressPercentage:0 };
  if (current >= expiry) return { status:"expired",remainingMs:0,remainingDays:0,remainingHours:0,remainingMinutes:0,progressPercentage:100 };
  const remainingMs = expiry - current;
  const remainingDays = Math.floor(remainingMs / DAY_MS);
  const remainingHours = Math.floor((remainingMs % DAY_MS) / HOUR_MS);
  const remainingMinutes = Math.floor((remainingMs % HOUR_MS) / MINUTE_MS);
  const progressPercentage = Math.min(100,Math.max(0,Math.round(((current-start)/totalMs)*100)));
  return { status:"active",remainingMs,remainingDays,remainingHours,remainingMinutes,progressPercentage };
}

export function getRemainingDaysBadge(expiresAt, now = new Date()) {
  return Math.max(0,Math.ceil((asDate(expiresAt).getTime()-asDate(now).getTime())/DAY_MS));
}

export function durationLabel(value, unit) {
  const amount=Number(value);
  if(!Number.isInteger(amount)||amount<1||!["day","month","year"].includes(unit)) return null;
  const labels={day:amount===1?"يوم واحد":"أيام",month:amount===1?"شهر واحد":"أشهر",year:amount===1?"سنة واحدة":"سنوات"};
  return amount===1?labels[unit]:`${amount} ${labels[unit]}`;
}
