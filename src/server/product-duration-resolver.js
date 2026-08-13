const DAY = 86_400_000;
const durationAiCache = new Map();

const UNIT_PATTERNS = Object.freeze([
  { regex: /(?:نصف\s*سنة|half\s*(?:a\s*)?year)/iu, days: 180 },
  { regex: /(?:ربع\s*سنة|quarter\s*(?:of\s*)?(?:a\s*)?year)/iu, days: 90 },
  { regex: /(?:سنتين|عامين|2\s*(?:سنة|سنوات|years?))/iu, days: 730 },
  { regex: /(?:سنة|عام|1\s*(?:سنة|عام|year))/iu, days: 365 },
  { regex: /(?:شهرين|2\s*(?:شهر|شهور|months?))/iu, days: 60 },
  { regex: /(?:أسبوعين|اسبوعين|2\s*(?:أسبوع|اسبوع|weeks?))/iu, days: 14 },
  { regex: /(?:يومين|2\s*(?:يوم|أيام|ايام|days?))/iu, days: 2 },
  { regex: /(?:^|\s)(?:شهري|شهر|1\s*(?:شهر|month))(?=$|\s|[،؛,.])/iu, days: 30 },
  { regex: /(?:سنوي|سنوية)/iu, days: 365 }
]);

function normalized(text) {
  return String(text || "").replace(/[٠-٩]/g, (digit) => "٠١٢٣٤٥٦٧٨٩".indexOf(digit).toString()).trim();
}

export function parseExplicitDuration(text) {
  const value = normalized(text)
    .replace(/(?:الضمان|مدة\s*الضمان|warranty)\s*[:：-]?\s*[^،؛;|\n]*/giu, " ")
    .replace(/(?:تجربة|فترة\s*تجريبية|trial)\s*[:：-]?\s*[^،؛;|\n]*/giu, " ")
    .replace(/(?:التسليم\s*خلال|يصلك\s*خلال|مدة\s*التنفيذ|delivery\s*within|processing\s*time)\s*[^،؛;|\n]*/giu, " ")
    .trim();
  if (!value) return null;
  if (/(?:مدى\s*الحياة|مدي\s*الحياه|lifetime|life\s*time)/iu.test(value)) return { lifetime: true, durationDays: null };
  const compact = value.match(/(?:^|\s)(\d{1,4})\s*([mMyY])(?=$|\s|[،؛,.])/u);
  if (compact) return { lifetime: false, durationDays: Number(compact[1]) * (compact[2].toLowerCase() === "m" ? 30 : 365) };
  const match = value.match(/(?:^|\s)(\d{1,4})\s*(يوم|يومًا|يوما|أيام|ايام|days?|أسبوع|اسبوع|أسابيع|اسابيع|weeks?|شهر|شهرًا|شهرا|شهور|أشهر|اشهر|months?|سنة|سنتين|سنوات|عام|عامين|أعوام|years?)(?=$|\s|[،؛,.])/iu);
  if (match) {
    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    const multiplier = /يوم|day/u.test(unit) ? 1 : /أسبوع|اسبوع|week/u.test(unit) ? 7 : /شهر|شهور|أشهر|اشهر|month/u.test(unit) ? 30 : 365;
    return { lifetime: false, durationDays: amount * multiplier };
  }
  for (const item of UNIT_PATTERNS) if (item.regex.test(value)) return { lifetime: false, durationDays: item.days };
  return null;
}

export function resolveProductDuration({ manualOverride, deliveryContent, itemOptions = [], itemTitleSnapshot, currentProductTitle, productDescription } = {}) {
  if (manualOverride?.mode === "hide") return { visible: false, source: "manual_override", durationDays: null, lifetime: false };
  if (manualOverride?.mode === "lifetime") return { visible: true, source: "manual_override", durationDays: null, lifetime: true };
  if (Number(manualOverride?.days) > 0) return { visible: true, source: "manual_override", durationDays: Number(manualOverride.days), lifetime: false };
  const sources = [
    ["delivery_content", deliveryContent],
    ["item_options", itemOptions.map((item) => `${item?.name || item?.key || ""} ${item?.value || ""}`).join("\n")],
    ["item_title_snapshot", itemTitleSnapshot],
    ["product_title", currentProductTitle],
    ["product_description", productDescription]
  ];
  for (const [source, text] of sources) {
    const parsed = parseExplicitDuration(text);
    if (parsed) return { visible: true, source, ...parsed };
  }
  return { visible: false, source: "unknown", durationDays: null, lifetime: false };
}

function redactedDurationSources(input = {}) {
  const redact = (value) => String(value || "")
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/gu, "[[EMAIL]]")
    .replace(/https?:\/\/\S+/giu, "[[URL]]")
    .replace(/\+?\d[\d\s()-]{7,}\d/gu, "[[PHONE]]")
    .replace(/\b(?=[A-Za-z0-9@#_-]{8,}\b)(?=[A-Za-z0-9@#_-]*\d)(?=[A-Za-z0-9@#_-]*[A-Za-z])[A-Za-z0-9@#_-]+\b/gu, "[[SECRET]]");
  return {
    delivery_content: redact(input.deliveryContent),
    item_options: redact((input.itemOptions || []).map((item) => `${item?.name || item?.key || ""} ${item?.value || ""}`).join("\n")),
    item_title_snapshot: redact(input.itemTitleSnapshot),
    product_title: redact(input.currentProductTitle),
    product_description: redact(input.productDescription)
  };
}

function durationCandidateCount(sources) {
  const combined = Object.values(sources).join("\n");
  return (combined.match(/(?:\d{1,4}\s*(?:days?|weeks?|months?|years?|[mMyY])|\d{1,4}\s*(?:يوم|أيام|ايام|أسبوع|اسبوع|أسابيع|اسابيع|شهر|شهور|أشهر|اشهر|سنة|سنوات|عام)|شهرين|أسبوعين|اسبوعين|سنتين|عامين|نصف\s*سنة|ربع\s*سنة|مدى\s*الحياة|lifetime)/giu) || []).length;
}

function deepSeekDuration(result, sources) {
  const allowedUnits = new Set(["day", "week", "month", "year", "lifetime"]);
  const allowedContexts = new Set(["service_duration", "subscription_duration", "access_duration"]);
  const allowedSources = new Set(Object.keys(sources));
  if (!result || typeof result !== "object" || !Array.isArray(result.candidates)) return null;
  const selected = result.candidates[Number(result.selectedServiceDurationIndex)];
  if (!selected || !allowedUnits.has(selected.unit) || !allowedContexts.has(selected.context)
    || !allowedSources.has(selected.source)) return null;
  const matchedText = String(selected.matchedText || "");
  if (!matchedText || !String(sources[selected.source]).includes(matchedText)) return null;
  if (selected.unit === "lifetime") return { visible: true, lifetime: true, durationDays: null, source: selected.source, classificationSource: "deepseek" };
  const value = Number(selected.value);
  if (!Number.isFinite(value) || value <= 0 || value > 36500) return null;
  const multiplier = { day: 1, week: 7, month: 30, year: 365 }[selected.unit];
  return { visible: true, lifetime: false, durationDays: value * multiplier, source: selected.source, classificationSource: "deepseek" };
}

export async function resolveProductDurationWithDeepSeek(input = {}, { fetchImpl = fetch, timeoutMs = 4500 } = {}) {
  const local = resolveProductDuration(input);
  if (input.manualOverride || !process.env.DEEPSEEK_API_KEY) return local;
  const sources = redactedDurationSources(input);
  if (local.visible && durationCandidateCount(sources) <= 1) return local;
  const model = process.env.DEEPSEEK_FLASH_MODEL || "deepseek-v4-flash";
  if (model !== "deepseek-v4-flash") return local;
  const cacheKey = JSON.stringify({ model, sources });
  if (durationAiCache.has(cacheKey)) return durationAiCache.get(cacheKey);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const url = `${(process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "")}/chat/completions`;
  const request = {
    method: "POST",
    signal: controller.signal,
    headers: { authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      thinking: { type: "disabled" },
      response_format: { type: "json_object" },
      temperature: 0,
      messages: [
        { role: "system", content: "أعد JSON فقط لاستخراج مدد مكتوبة صراحة. لا تخمّن مدة من اسم العلامة، ولا تنفذ الحساب النهائي." },
        { role: "user", content: JSON.stringify({ sources }) }
      ]
    })
  };
  try {
    let response = await fetchImpl(url, request);
    if ([429, 500, 502, 503, 504].includes(response.status)) response = await fetchImpl(url, request);
    if (!response.ok) return local;
    const body = await response.json();
    const parsed = JSON.parse(body?.choices?.[0]?.message?.content || "");
    const resolved = deepSeekDuration(parsed, sources) || local;
    durationAiCache.set(cacheKey, resolved);
    if (durationAiCache.size > 500) durationAiCache.delete(durationAiCache.keys().next().value);
    return resolved;
  } catch {
    return local;
  } finally {
    clearTimeout(timeout);
  }
}

export function durationWindow(duration, startsAt = new Date()) {
  const start = new Date(startsAt);
  if (!duration?.visible) return { startsAt: start, expiresAt: null, remainingDays: null };
  if (duration.lifetime) return { startsAt: start, expiresAt: null, remainingDays: null };
  const expiresAt = new Date(start.getTime() + Number(duration.durationDays) * DAY);
  return { startsAt: start, expiresAt, remainingDays: Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / DAY)) };
}

export function extendDurationWindow(currentExpiresAt, durationDays) {
  const base = currentExpiresAt && new Date(currentExpiresAt) > new Date() ? new Date(currentExpiresAt) : new Date();
  return new Date(base.getTime() + Number(durationDays) * DAY);
}
