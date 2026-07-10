function toMinutes(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function isQuietHour(now, start = "21:00", end = "09:00") {
  const current = now.getHours() * 60 + now.getMinutes();
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);

  if (startMinutes > endMinutes) {
    return current >= startMinutes || current < endMinutes;
  }

  return current >= startMinutes && current < endMinutes;
}

export function evaluateMessageQuality(message) {
  const text = String(message || "");
  const links = text.match(/https?:\/\//g) || [];
  const warnings = [];
  let risk = 0;

  if (links.length > 2) {
    warnings.push("Too many links");
    risk += 25;
  }

  if (/free|win|urgent|limited|خصم|مجاني|عاجل/i.test(text)) {
    warnings.push("Marketing-heavy language");
    risk += 25;
  }

  if (!/{{customer_name}}|أحمد|محمد|سارة|نورة|خالد/.test(text)) {
    warnings.push("Personalization is missing");
    risk += 10;
  }

  if (!/stop|إيقاف|الغاء|إلغاء/i.test(text)) {
    warnings.push("Unsubscribe option is missing");
    risk += 10;
  }

  return {
    score: risk >= 50 ? "risk" : warnings.length ? "warning" : "excellent",
    risk,
    warnings
  };
}

export function canSendSafely(context) {
  const {
    safeModeEnabled = true,
    hourlySent = 0,
    dailySent = 0,
    hourlyLimit = 20,
    dailyLimit = 100,
    now = new Date(),
    quietHoursStart = "21:00",
    quietHoursEnd = "09:00",
    unsubscribed = false,
    duplicateWithinWindow = false,
    failRatePercent = 0,
    maxFailRatePercent = 20,
    riskScore = 0,
    maxBlockRiskScore = 70,
    channelStatus = "connected"
  } = context;

  if (!safeModeEnabled) return { ok: true };
  if (channelStatus !== "connected") return { ok: false, reason: "channel_disconnected" };
  if (unsubscribed) return { ok: false, reason: "unsubscribed" };
  if (hourlySent >= hourlyLimit) return { ok: false, reason: "hourly_limit" };
  if (dailySent >= dailyLimit) return { ok: false, reason: "daily_limit" };
  if (isQuietHour(now, quietHoursStart, quietHoursEnd)) return { ok: false, reason: "quiet_hours" };
  if (duplicateWithinWindow) return { ok: false, reason: "duplicate_message" };
  if (failRatePercent > maxFailRatePercent) return { ok: false, reason: "high_failure_rate" };
  if (riskScore > maxBlockRiskScore) return { ok: false, reason: "high_risk_score" };

  return { ok: true };
}
