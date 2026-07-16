export const ORDER_LINK_STYLES = new Set(["classic", "modern", "professional", "minimal", "premium", "colorful"]);
export const ORDER_LINK_COLORS = new Set(["#2563EB", "#06B6D4", "#8B5CF6", "#22C55E", "#F97316", "#EF4444", "#64748B", "#0F172A"]);
export const RESERVED_ORDER_SLUGS = new Set([
  "admin", "api", "dashboard", "login", "register", "support", "pricing", "blog", "terms", "privacy", "o"
]);

export const DEFAULT_VISIBLE_FIELDS = Object.freeze({
  customerName: true,
  planName: true,
  startDate: true,
  endDate: true,
  remainingDays: true,
  status: true,
  storeName: true,
  additionalNotes: true,
  phoneNumber: false
});

export function normalizeOrderSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

export function validateOrderSlug(value) {
  const slug = normalizeOrderSlug(value);
  if (!slug || slug.length < 3 || slug.length > 60) return { ok: false, reason: "invalid_slug" };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return { ok: false, reason: "invalid_slug" };
  if (RESERVED_ORDER_SLUGS.has(slug)) return { ok: false, reason: "reserved_slug" };
  return { ok: true, slug };
}

export function normalizeOrderLinkStyle(value) {
  return ORDER_LINK_STYLES.has(value) ? value : "classic";
}

export function normalizeOrderLinkColor(value) {
  const normalized = String(value || "").toUpperCase();
  return ORDER_LINK_COLORS.has(normalized) ? normalized : "#2563EB";
}

export function normalizeAdditionalNotes(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((item) => item.slice(0, 300));
}

export function normalizeVisibleFields(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.fromEntries(
    Object.keys(DEFAULT_VISIBLE_FIELDS).map((key) => [key, source[key] === undefined ? DEFAULT_VISIBLE_FIELDS[key] : Boolean(source[key])])
  );
}

export function remainingSubscriptionDays(endDate, now = new Date()) {
  const end = new Date(`${String(endDate).slice(0, 10)}T23:59:59.999Z`);
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (Number.isNaN(end.getTime())) return { days: 0, state: "expired" };
  const days = Math.ceil((end.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return { days, state: "expired" };
  if (days === 0) return { days: 0, state: "today" };
  return { days, state: "remaining" };
}

export function inferSubscriptionStatus(startDate, endDate, now = new Date()) {
  const start = new Date(`${String(startDate || "").slice(0, 10)}T00:00:00.000Z`);
  const end = new Date(`${String(endDate || "").slice(0, 10)}T23:59:59.999Z`);
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null;
  if (end < today) return "expired";
  const remainingDays = Math.ceil((end.getTime() - today.getTime()) / 86_400_000);
  return remainingDays <= 7 ? "expiring_soon" : "active";
}

export function maskPublicPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length < 7) return "";
  const country = digits.startsWith("966") ? "+966 " : "+";
  const local = digits.startsWith("966") ? digits.slice(3) : digits;
  return `${country}${local.slice(0, 2)} *** ${local.slice(-4)}`;
}
