import { query } from "./db.js";

const planOrder = ["starter", "professional", "business", "enterprise"];

function numberOrNull(value, { positive = false } = {}) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || (positive && parsed <= 0)) return null;
  return parsed;
}

function localizedNumber(value) {
  return Number(value).toLocaleString("ar-SA");
}

function storageLabel(megabytes) {
  const value = numberOrNull(megabytes);
  if (value === null || value < 0) return "تخزين مخصص حسب الاتفاق";
  if (value >= 1024 && value % 1024 === 0) return `${localizedNumber(value / 1024)} GB مساحة تخزين`;
  return `${localizedNumber(value)} MB مساحة تخزين`;
}

export function derivePlanFeatures(plan) {
  const features = [];
  const addLimit = (value, singular, unlimited) => {
    const amount = numberOrNull(value);
    if (amount === null) return;
    features.push(amount < 0 ? unlimited : `${localizedNumber(amount)} ${singular}`);
  };

  features.push(storageLabel(plan.storageLimitMb));
  addLimit(plan.emailMessageLimit, "رسالة بريد شهريًا", "رصيد بريد مخصص حسب الاتفاق");
  addLimit(plan.whatsappChannelsLimit, "قناة واتساب رسمية", "قنوات واتساب حسب الاتفاق");
  addLimit(plan.customersLimit, "جهة اتصال", "جهات اتصال غير محدودة");
  addLimit(plan.usersLimit, "مستخدمًا في الفريق", "مستخدمون حسب الاتفاق");
  addLimit(plan.orderLinksLimit, "رابط معلومات طلب", "روابط معلومات طلب غير محدودة");
  if (plan.campaignsEnabled) features.push("حملات واتساب والبريد");
  if (plan.automationEnabled) features.push("الأتمتة وإعادة الاستهداف");
  if (plan.customApiEnabled) features.push("API مخصص");
  if (plan.sallaEnabled) features.push("تكامل سلة ومزامنة الطلبات");
  if (plan.contactSales) features.push("حدود ودعم مخصصان حسب احتياج المؤسسة");
  return features;
}

export function normalizeCatalogPlan(row) {
  const slug = String(row.slug || "").toLowerCase();
  const plan = {
    id: row.id,
    slug,
    name: row.name,
    description: row.descriptionAr || "",
    monthlyPriceSar: numberOrNull(row.monthlyPriceSar, { positive: true }),
    yearlyPriceSar: numberOrNull(row.yearlyPriceSar, { positive: true }),
    emailMessageLimit: numberOrNull(row.emailMessageLimit),
    whatsappChannelsLimit: numberOrNull(row.whatsappChannelsLimit),
    customersLimit: numberOrNull(row.customersLimit),
    usersLimit: numberOrNull(row.usersLimit),
    storageLimitMb: numberOrNull(row.storageLimitMb),
    orderLinksLimit: numberOrNull(row.orderLinksLimit),
    campaignsEnabled: Boolean(row.campaignsEnabled),
    automationEnabled: Boolean(row.automationEnabled),
    customApiEnabled: Boolean(row.customApiEnabled),
    sallaEnabled: Boolean(row.sallaEnabled),
    popular: Boolean(row.popular),
    contactSales: Boolean(row.contactSales || row.customPricing),
    displayOrder: numberOrNull(row.displayOrder) ?? planOrder.indexOf(slug) + 1
  };
  return { ...plan, features: derivePlanFeatures(plan) };
}

export async function getActivePlanCatalog(runner = { query }) {
  const result = await runner.query(
    `SELECT id,name,slug,description_ar AS "descriptionAr",
            monthly_price_sar AS "monthlyPriceSar",yearly_price_sar AS "yearlyPriceSar",
            COALESCE(email_message_limit,monthly_message_limit) AS "emailMessageLimit",
            whatsapp_channels_limit AS "whatsappChannelsLimit",
            customers_limit AS "customersLimit",users_limit AS "usersLimit",
            storage_limit_mb AS "storageLimitMb",order_links_limit AS "orderLinksLimit",
            campaigns_enabled AS "campaignsEnabled",automation_enabled AS "automationEnabled",
            custom_api_enabled AS "customApiEnabled",salla_enabled AS "sallaEnabled",
            custom_pricing AS "customPricing",popular,contact_sales AS "contactSales",
            display_order AS "displayOrder"
       FROM platform_plans
      WHERE is_active=true AND slug = ANY($1::text[])
      ORDER BY display_order,created_at`,
    [planOrder]
  );
  const bySlug = new Map(result.rows.map((row) => [String(row.slug).toLowerCase(), normalizeCatalogPlan(row)]));
  return planOrder.map((slug) => bySlug.get(slug)).filter(Boolean);
}

export const PAID_PLAN_SLUGS = Object.freeze([...planOrder]);
