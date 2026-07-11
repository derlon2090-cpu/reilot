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

  if (/free|win|urgent|limited|خصم|مجاني|عاجل|لفترة محدودة/i.test(text)) {
    warnings.push("Marketing-heavy language");
    risk += 25;
  }

  if (!/{{customer_name}}|{{name}}|أحمد|محمد|سارة|نورة|خالد/.test(text)) {
    warnings.push("Personalization is missing");
    risk += 10;
  }

  if (!/stop|unsubscribe|إيقاف|توقف|لا ترسل|الغاء|إلغاء/i.test(text)) {
    warnings.push("Unsubscribe option is missing");
    risk += 10;
  }

  return {
    score: risk >= 50 ? "risk" : warnings.length ? "warning" : "excellent",
    risk,
    warnings
  };
}

export function warmupDailyLimit(day) {
  const value = Math.max(1, Number(day) || 1);
  if (value >= 14) return 200;
  if (value >= 7) return 60;
  if (value >= 5) return 35;
  return [10, 15, 20, 25][value - 1] || 35;
}

export function whatsappHealthScore({ failureRate = 0, unsubscribeCount = 0, disconnected = false, hourlySent = 0, hourlyLimit = 20 }) {
  const risk = Math.min(100, Math.round(
    Number(failureRate) * 2 +
    Number(unsubscribeCount) * 8 +
    (disconnected ? 35 : 0) +
    (hourlySent >= hourlyLimit ? 20 : 0)
  ));
  const status = risk <= 15 ? "excellent" : risk <= 35 ? "good" : risk <= 65 ? "medium" : "danger";
  return { risk, status };
}

export const blockedReasonMessages = {
  ar: {
    unsubscribed: "لم يتم الإرسال لأن العميل في قائمة الإيقاف.",
    duplicate_message: "لم يتم الإرسال لأن الرسالة مكررة.",
    quiet_hours: "لم يتم الإرسال لأن الوقت خارج ساعات الإرسال.",
    channel_disconnected: "لم يتم الإرسال لأن رقم واتساب غير متصل.",
    monthly_limit: "لم يتم الإرسال لأن حد الرسائل الشهري انتهى.",
    high_risk_score: "لم يتم الإرسال لأن درجة المخاطر مرتفعة.",
    hourly_limit: "لم يتم الإرسال لأن الحد الساعي اكتمل.",
    daily_limit: "لم يتم الإرسال لأن الحد اليومي اكتمل.",
    high_failure_rate: "لم يتم الإرسال لأن نسبة الفشل مرتفعة."
  },
  en: {
    unsubscribed: "The customer has opted out of messages.",
    duplicate_message: "The message was blocked as a duplicate.",
    quiet_hours: "The message is outside permitted sending hours.",
    channel_disconnected: "The WhatsApp number is disconnected.",
    monthly_limit: "The monthly message limit has been reached.",
    high_risk_score: "The WhatsApp risk score is too high.",
    hourly_limit: "The hourly message limit has been reached.",
    daily_limit: "The daily message limit has been reached.",
    high_failure_rate: "The recent failure rate is too high."
  }
};

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
  if (duplicateWithinWindow) return { ok: false, reason: "duplicate_message" };
  if (failRatePercent > maxFailRatePercent) return { ok: false, reason: "high_failure_rate" };
  if (riskScore > maxBlockRiskScore) return { ok: false, reason: "high_risk_score" };
  if (isQuietHour(now, quietHoursStart, quietHoursEnd)) return { ok: false, reason: "quiet_hours" };

  return { ok: true };
}
