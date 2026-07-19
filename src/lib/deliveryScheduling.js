const DEFAULTS = {
  timezone: "Asia/Riyadh",
  allowedStart: "10:00",
  allowedEnd: "20:30",
  autoWhatsAppDelaySeconds: 300,
  manualWhatsAppDelaySeconds: 120,
  jitterMinSeconds: 20,
  jitterMaxSeconds: 90,
  mediumRiskDelaySeconds: 600,
  highRiskDelaySeconds: 1800,
  fridayEnabled: false
};

function number(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clockMinutes(value, fallback) {
  const match = String(value || fallback).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return clockMinutes(fallback, "00:00");
  return Number(match[1]) * 60 + Number(match[2]);
}

const zonedFormatters = new Map();

function zonedParts(date, timezone) {
  let formatter = zonedFormatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    });
    zonedFormatters.set(timezone, formatter);
  }
  const parts = formatter.formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function isWithinSendingWindow(date = new Date(), settings = {}) {
  const timezone = settings.timezone || DEFAULTS.timezone;
  const parts = zonedParts(date, timezone);
  if (parts.weekday === "Fri" && settings.fridayEnabled !== true) return false;
  const current = Number(parts.hour) * 60 + Number(parts.minute);
  const start = clockMinutes(settings.allowedStart, DEFAULTS.allowedStart);
  const end = clockMinutes(settings.allowedEnd, DEFAULTS.allowedEnd);
  return current >= start && current <= end;
}

export function nextSendingWindow(date = new Date(), settings = {}) {
  if (isWithinSendingWindow(date, settings)) return new Date(date);
  const candidate = new Date(date);
  candidate.setUTCSeconds(0, 0);
  for (let minute = 0; minute < 60 * 24 * 8; minute += 1) {
    candidate.setUTCMinutes(candidate.getUTCMinutes() + 1);
    if (isWithinSendingWindow(candidate, settings)) return candidate;
  }
  throw new Error("Unable to calculate the next sending window");
}

export function riskDisposition(riskScore = 0) {
  const score = Math.max(0, Math.min(100, number(riskScore, 0)));
  if (score >= 85) return { action: "hold", delaySeconds: 0, reason: "critical_risk" };
  if (score >= 70) return { action: "pause", delaySeconds: 7200, reason: "high_risk" };
  if (score >= 60) return { action: "pause", delaySeconds: 2700, reason: "elevated_risk" };
  if (score >= 40) return { action: "slow", delaySeconds: 600, reason: "medium_risk" };
  return { action: "allow", delaySeconds: 0, reason: null };
}

export function calculateSmartDelaySeconds({
  channelType,
  sourceMode = "automatic",
  messageType,
  riskScore = 0,
  healthScore = 100,
  connectedAt,
  settings = {},
  random = Math.random
}) {
  if (channelType !== "whatsapp" || messageType === "test_message") {
    return { delaySeconds: 0, delayReason: channelType === "whatsapp" ? "test_message" : "channel_not_throttled" };
  }
  const auto = number(settings.autoWhatsAppDelaySeconds, DEFAULTS.autoWhatsAppDelaySeconds);
  const manual = number(settings.manualWhatsAppDelaySeconds, DEFAULTS.manualWhatsAppDelaySeconds);
  let delay = sourceMode === "manual" ? manual : auto;
  let reason = sourceMode === "manual" ? "manual_whatsapp_spacing" : "automatic_whatsapp_spacing";
  const risk = riskDisposition(riskScore);
  if (risk.delaySeconds > delay) {
    delay = risk.delaySeconds;
    reason = risk.reason;
  }
  if (number(healthScore, 100) < 40 && delay < number(settings.highRiskDelaySeconds, DEFAULTS.highRiskDelaySeconds)) {
    delay = number(settings.highRiskDelaySeconds, DEFAULTS.highRiskDelaySeconds);
    reason = "low_health_score";
  }
  if (connectedAt) {
    const ageDays = (Date.now() - new Date(connectedAt).getTime()) / 86_400_000;
    if (Number.isFinite(ageDays) && ageDays < 2 && delay < 600) {
      delay = 600;
      reason = "new_channel_warmup";
    } else if (Number.isFinite(ageDays) && ageDays < 7 && delay < 420) {
      delay = 420;
      reason = "channel_warmup";
    }
  }
  const minJitter = Math.max(0, number(settings.jitterMinSeconds, DEFAULTS.jitterMinSeconds));
  const configuredMaxJitter = Math.max(minJitter, number(settings.jitterMaxSeconds, DEFAULTS.jitterMaxSeconds));
  const maxJitter = sourceMode === "manual" ? Math.min(configuredMaxJitter, 60) : configuredMaxJitter;
  const jitter = Math.floor(minJitter + Math.max(0, Math.min(1, random())) * (maxJitter - minJitter));
  return { delaySeconds: Math.round(delay + jitter), delayReason: reason };
}

export function scheduleDelivery({ now = new Date(), channelType, delaySeconds = 0, settings = {} }) {
  const delayed = new Date(now.getTime() + Math.max(0, delaySeconds) * 1000);
  return channelType === "whatsapp" ? nextSendingWindow(delayed, settings) : delayed;
}

export { DEFAULTS as deliveryScheduleDefaults };
