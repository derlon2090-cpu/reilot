function localDateTimeValue(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function platformNotificationScheduleDefaults(now = new Date()) {
  const current = new Date(now);
  if (Number.isNaN(current.getTime())) throw new TypeError("A valid date is required");

  current.setSeconds(0, 0);
  const scheduled = new Date(current.getTime() + 5 * 60_000);
  scheduled.setMinutes(Math.ceil(scheduled.getMinutes() / 5) * 5, 0, 0);

  return {
    minimum: localDateTimeValue(current),
    scheduledAt: localDateTimeValue(scheduled)
  };
}
