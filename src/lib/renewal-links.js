import { z } from "zod";

const blockedHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);

export function safeRenewalUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || blockedHosts.has(host) || host.endsWith(".localhost")) return null;
    if (/^(?:0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/.test(host)) return null;
    if (/^\[(?:fc|fd|fe8|fe9|fea|feb)/i.test(host)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

const nullableText = z.preprocess((value) => {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}, z.string().nullable());

export const renewalOptionSchema = z.object({
  label: z.string().trim().min(2).max(80),
  customerNote: z.preprocess((value) => String(value ?? "").trim() || null, z.string().max(240).nullable()),
  linkMode: z.enum(["automatic", "manual"]),
  manualUrl: nullableText,
  targetSallaProductId: nullableText,
  targetSallaVariantId: nullableText,
  targetSallaSku: nullableText,
  durationValue: z.coerce.number().int().positive().max(1000),
  durationUnit: z.enum(["day", "month", "year"]),
  showInPortal: z.boolean().default(true),
  showInWhatsapp: z.boolean().default(false),
  showInEmail: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(1000).default(0)
}).superRefine((data, context) => {
  if (data.linkMode === "manual" && !safeRenewalUrl(data.manualUrl)) {
    context.addIssue({ code: "custom", path: ["manualUrl"], message: "أدخل رابط تجديد آمنًا يبدأ بـ HTTPS" });
  }
  if (data.linkMode === "automatic" && !data.targetSallaProductId && !data.targetSallaVariantId) {
    context.addIssue({ code: "custom", path: ["targetSallaProductId"], message: "اختر منتج التجديد من سلة" });
  }
});

export function parseRenewalOption(input) {
  const parsed = renewalOptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, issues: parsed.error.issues };
  const value = parsed.data;
  return {
    ok: true,
    value: {
      ...value,
      manualUrl: value.linkMode === "manual" ? safeRenewalUrl(value.manualUrl) : null
    }
  };
}

export function extractSallaCustomerUrl(product = {}, variant = null) {
  const candidates = [
    variant?.urls?.customer,
    product?.urls?.customer,
    variant?.url,
    product?.url
  ];
  for (const candidate of candidates) {
    const safe = safeRenewalUrl(candidate);
    if (safe) return safe;
  }
  return null;
}

export function findRenewalCatalogProduct(products, target) {
  if (target.targetSallaVariantId) {
    const match = products.find((item) => String(item.variantId || "") === String(target.targetSallaVariantId));
    if (match) return match;
  }
  if (target.targetSallaProductId) {
    const match = products.find((item) => String(item.productId || "") === String(target.targetSallaProductId));
    if (match) return match;
  }
  if (target.targetSallaSku) {
    const match = products.find((item) => String(item.sku || "") === String(target.targetSallaSku));
    if (match) return match;
  }
  return null;
}

export function resolveStoredRenewalOption(option, catalogProduct = null) {
  if (!option?.isActive) return { ok: false, reason: "renewal_option_unavailable" };
  if (option.linkMode === "manual") {
    const url = safeRenewalUrl(option.manualUrl);
    return url ? { ok: true, url, source: "manual" } : { ok: false, reason: "manual_url_missing" };
  }
  const url = safeRenewalUrl(catalogProduct?.customerUrl) || safeRenewalUrl(option.resolvedUrl);
  if (!url) return { ok: false, reason: "salla_customer_url_missing" };
  return { ok: true, url, source: "salla", lastSyncedAt: catalogProduct?.lastSyncedAt || option.lastSyncedAt || null };
}
