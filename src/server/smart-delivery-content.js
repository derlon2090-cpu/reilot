import crypto from "node:crypto";

const FIELD_META = Object.freeze({
  email: { label: "البريد الإلكتروني", sensitive: true },
  username: { label: "اسم المستخدم", sensitive: true },
  password: { label: "كلمة المرور", sensitive: true },
  activation_code: { label: "كود التفعيل", sensitive: true },
  pin: { label: "رمز PIN", sensitive: true },
  url: { label: "رابط الدخول", sensitive: true },
  serial: { label: "الرقم التسلسلي", sensitive: true },
  expires_at: { label: "تاريخ الانتهاء", sensitive: false },
  warranty: { label: "الضمان", sensitive: false },
  instruction: { label: "تعليمات مهمة", sensitive: false },
  other: { label: "معلومات إضافية", sensitive: false }
});
const classificationCache = new Map();

const LABELS = Object.freeze([
  ["password", /^(?:كلمة\s*المرور|كلمه\s*المرور|الباس(?:ورد)?|pass(?:word)?|pwd)\s*[:：-]?\s*(.+)$/iu],
  ["email", /^(?:البريد(?:\s*الإلكتروني)?|الايميل|الإيميل|e-?mail)\s*[:：-]?\s*(.+)$/iu],
  ["username", /^(?:اسم\s*المستخدم|المستخدم|يوزر(?:نيم)?|user(?:name)?)\s*[:：-]?\s*(.+)$/iu],
  ["pin", /^(?:pin|رمز\s*pin|الرقم\s*السري)\s*[:：-]?\s*(.+)$/iu],
  ["activation_code", /^(?:ال?كود\s*(?:التفعيل|الدخول)?|رمز\s*التفعيل|activation(?:\s*code)?|code|key)\s*[:：-]?\s*(.+)$/iu],
  ["serial", /^(?:serial(?:\s*number)?|السيريال|الرقم\s*التسلسلي)\s*[:：-]?\s*(.+)$/iu],
  ["url", /^(?:الرابط|رابط\s*(?:الدخول|المنتج)?|الدخول\s*من\s*الرابط\s*التالي|login|url|link)\s*[:：-]?\s*(https?:\/\/\S+)$/iu],
  ["expires_at", /^(?:تاريخ\s*الانتهاء|ينتهي\s*في|expiry|expires?)\s*[:：-]?\s*(.+)$/iu],
  ["warranty", /^(?:الضمان|warranty)\s*[:：-]?\s*(.+)$/iu]
]);

function normalizeLines(raw) {
  return String(raw || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .split("\n")
    .flatMap((line) => line.split(/\s+\|\s+/u))
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 300);
}

function looksSecretLike(value) {
  const text = String(value || "").trim();
  if (text.length < 6 || text.length > 500 || /\s/u.test(text)) return false;
  const classes = [/[a-z]/u, /[A-Z]/u, /\d/u, /[^A-Za-z0-9]/u].filter((pattern) => pattern.test(text)).length;
  return classes >= 2 && /\d/u.test(text) && (classes >= 3 || text.length >= 12);
}

function field(type, value, sourceLine) {
  const meta = FIELD_META[type] || FIELD_META.other;
  const cleanValue = String(value || "").trim();
  return { type, label: meta.label, value: cleanValue, sensitive: meta.sensitive || looksSecretLike(cleanValue), sourceLine };
}

function exactEmail(line) {
  return line.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/u)?.[0] || null;
}

function exactUrl(line) {
  return line.match(/^https:\/\/[^\s]+$/iu)?.[0] || null;
}

function looksLikeInstruction(line) {
  return /^(?:مهم|تنبيه|ملاحظة|تعليمات|الرجاء|يرجى|لا\s|يمنع|للاستخدام|note|important|do not|please)/iu.test(line);
}

function uniqueFields(fields) {
  const seen = new Set();
  return fields.filter((item) => {
    const key = `${item.type}:${item.value}`;
    if (!item.value || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parseSmartDeliveryContent(raw, { productName = "" } = {}) {
  const lines = normalizeLines(raw);
  const fields = [];
  const unmatched = [];
  for (const line of lines) {
    let matched = false;
    for (const [type, pattern] of LABELS) {
      const match = line.match(pattern);
      if (match?.[1]) {
        if (type === "password" && /^[@#]/u.test(match[1]) && /^pass[@#]/iu.test(line)) continue;
        fields.push(field(type, match[1], line));
        matched = true;
        break;
      }
    }
    if (matched) continue;
    const email = exactEmail(line);
    if (email) fields.push(field("email", email, line));
    else {
      const url = exactUrl(line);
      if (url) fields.push(field("url", url, line));
      else if (looksLikeInstruction(line)) fields.push(field("instruction", line, line));
      else if (/^\d{4,8}$/u.test(line)) fields.push(field("pin", line, line));
      else if (looksSecretLike(line)) fields.push(field("activation_code", line, line));
      else unmatched.push(line);
    }
  }

  // A common Salla format is an unlabeled email followed by an unlabeled password.
  const hasPassword = fields.some((item) => item.type === "password");
  const emailIndex = lines.findIndex((line) => exactEmail(line));
  if (!hasPassword && emailIndex >= 0) {
    const candidate = lines[emailIndex + 1];
    if (candidate && !exactEmail(candidate) && !exactUrl(candidate) && !looksLikeInstruction(candidate)
      && !/\s/u.test(candidate) && /[A-Za-z0-9]/u.test(candidate)) {
      fields.push(field("password", candidate, candidate));
      const index = unmatched.indexOf(candidate);
      if (index >= 0) unmatched.splice(index, 1);
    }
  }

  const title = String(productName || unmatched.shift() || "منتج رقمي").trim().slice(0, 240);
  for (const line of unmatched) fields.push(field("other", line, line));
  const clean = uniqueFields(fields);
  return {
    title,
    fields: clean,
    instructions: clean.filter((item) => item.type === "instruction").map((item) => item.value),
    ambiguous: clean.some((item) => item.type === "other"),
    parserVersion: "local-v1"
  };
}

function configuredValue(entry, key) {
  if (!entry || typeof entry !== "object") return "";
  return String(entry.key ?? entry.name ?? entry.code ?? entry.slug ?? "") === key
    ? String(entry.value ?? entry.text ?? entry.content ?? "").trim()
    : "";
}

export function extractTrustedDeliveryContent(order, config) {
  const sourceType = String(config?.sourceType || "");
  const sourceFieldKey = String(config?.sourceFieldKey || "").trim();
  if (!config?.enabled || !sourceFieldKey) return [];
  const items = Array.isArray(order?.items) ? order.items : [];
  const result = [];
  if (sourceType === "order_custom_field") {
    const collections = [order?.custom_fields, order?.customFields, order?.options].filter(Array.isArray);
    const content = collections.flat().map((entry) => configuredValue(entry, sourceFieldKey)).find(Boolean);
    if (content) result.push({ orderItemId: "order", productName: items[0]?.name || "منتج رقمي", content });
  } else if (["item_custom_field", "item_option", "digital_product_field"].includes(sourceType)) {
    for (const [index, item] of items.entries()) {
      const collections = [item?.custom_fields, item?.customFields, item?.options, item?.digital_fields, item?.digitalFields].filter(Array.isArray);
      const direct = sourceType === "digital_product_field" && String(item?.digital?.[sourceFieldKey] || "").trim();
      const content = direct || collections.flat().map((entry) => configuredValue(entry, sourceFieldKey)).find(Boolean);
      if (content) result.push({ orderItemId: String(item.id || item.product_id || index + 1), productName: item.name || item.product?.name || `منتج رقمي ${index + 1}`, content });
    }
  } else if (sourceType === "fulfillment_field") {
    const content = String(order?.fulfillment?.[sourceFieldKey] || order?.fulfilment?.[sourceFieldKey] || "").trim();
    if (content) result.push({ orderItemId: "order", productName: items[0]?.name || "منتج رقمي", content });
  }
  return result;
}

export function tokenizeDeliverySecrets(parsed) {
  const tokenMap = new Map();
  const counters = new Map();
  const fields = parsed.fields.map((item) => {
    if (!item.sensitive) return { ...item };
    const base = item.type.toUpperCase();
    const count = (counters.get(base) || 0) + 1;
    counters.set(base, count);
    const token = `[[${base}_${count}]]`;
    tokenMap.set(token, item.value);
    return { ...item, value: token, sourceLine: undefined };
  });
  return { redacted: { ...parsed, fields }, tokenMap };
}

export function restoreDeliveryTokens(classified, tokenMap) {
  const allowed = new Set(tokenMap.keys());
  const fields = Array.isArray(classified?.fields) ? classified.fields : [];
  for (const item of fields) {
    const tokens = String(item.value || "").match(/\[\[[A-Z_]+_\d+\]\]/g) || [];
    if (tokens.some((token) => !allowed.has(token))) throw new Error("deepseek_invented_token");
  }
  return {
    ...classified,
    fields: fields.map((item) => ({ ...item, value: tokenMap.get(item.value) || item.value }))
  };
}

export async function classifyAmbiguousDeliveryContent(parsed, { fetchImpl = fetch, timeoutMs = 4500 } = {}) {
  if (!parsed.ambiguous || !process.env.DEEPSEEK_API_KEY) return { ...parsed, classificationSource: "local" };
  const { redacted, tokenMap } = tokenizeDeliverySecrets(parsed);
  const model = process.env.DEEPSEEK_FLASH_MODEL || "deepseek-v4-flash";
  if (model !== "deepseek-v4-flash") return { ...parsed, classificationSource: "local_fallback" };
  const cacheKey = crypto.createHash("sha256").update(`${parsed.parserVersion}:${model}:${JSON.stringify(redacted)}`).digest("hex");
  if (classificationCache.has(cacheKey)) {
    return { ...restoreDeliveryTokens(structuredClone(classificationCache.get(cacheKey)), tokenMap), classificationSource: "deepseek_cache" };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const request = {
      method: "POST",
      signal: controller.signal,
      headers: { authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        thinking: { type: "disabled" },
        response_format: { type: "json_object" },
        temperature: 0,
        messages: [{ role: "system", content: "صنّف الحقول فقط وأعد JSON مطابقًا. لا تنشئ أو تغيّر أي token." }, { role: "user", content: JSON.stringify(redacted) }]
      })
    };
    let response = await fetchImpl(`${(process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "")}/chat/completions`, request);
    if ([429, 500, 502, 503, 504].includes(response.status)) {
      response = await fetchImpl(`${(process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "")}/chat/completions`, request);
    }
    if (!response.ok) return { ...parsed, classificationSource: "local_fallback" };
    const body = await response.json();
    const content = body?.choices?.[0]?.message?.content;
    const classified = JSON.parse(content);
    classificationCache.set(cacheKey, structuredClone(classified));
    if (classificationCache.size > 500) classificationCache.delete(classificationCache.keys().next().value);
    const restored = restoreDeliveryTokens(classified, tokenMap);
    return { ...restored, classificationSource: "deepseek" };
  } catch {
    return { ...parsed, classificationSource: "local_fallback" };
  } finally {
    clearTimeout(timeout);
  }
}

export function deliveryContentHash(raw) {
  return crypto.createHash("sha256").update(String(raw || "")).digest("hex");
}
