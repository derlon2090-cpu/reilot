import crypto from "node:crypto";
import { query, transaction } from "./db.js";
import { getSallaAccessToken } from "./salla-app.js";
import { enqueueMessage } from "./message-queue.js";
import { getOrCreateSallaPublicPage } from "./salla-public-pages.js";

export const SALLA_TEMPLATE_KEYS = Object.freeze({
  ABANDONED_CART: "salla_abandoned_cart",
  UNDER_REVIEW: "salla_order_under_review",
  PROCESSING: "salla_order_processing",
  COMPLETED: "salla_order_completed",
  SHIPPED: "salla_order_shipped",
  OUT_FOR_DELIVERY: "salla_order_out_for_delivery",
  DELIVERED: "salla_order_delivered",
  RETURN_PENDING: "salla_order_return_pending",
  RETURNED: "salla_order_returned",
  INVOICE_READY: "salla_invoice_ready"
});

const definitions = [
  {
    key: SALLA_TEMPLATE_KEYS.ABANDONED_CART,
    name: "السلات المتروكة",
    description: "تسلسل تذكير آمن يعيد العميل إلى سلته ويتوقف فور تحوّلها إلى طلب.",
    triggerType: "abandoned_cart",
    eventName: "abandoned.cart",
    icon: "cart",
    variables: ["customer_name", "store_name", "cart_total", "currency", "items_count", "cart_items", "checkout_url"],
    body: "مرحبًا {{customer_name}} 👋\n\nلاحظنا أنك أضفت منتجات إلى سلتك ولم تكمل الطلب بعد.\n\nمنتجاتك لا تزال بانتظارك:\n{{cart_items}}\n\nاستكمل طلبك:\n{{checkout_url}}\n\nفريق {{store_name}}",
    settings: { delaysMinutes: [30, 1440, 4320], maxMessages: 3, stopOnConversion: true }
  },
  {
    key: SALLA_TEMPLATE_KEYS.UNDER_REVIEW,
    name: "تحت المراجعة",
    description: "إشعار العميل بأن الطلب قيد المراجعة قبل اعتماده.",
    triggerType: "order_status",
    icon: "clock",
    suggestedSlugs: ["under_review", "reviewing", "pending_review"],
    variables: ["customer_name", "order_number", "store_name", "order_url", "review_note"],
    body: "مرحبًا {{customer_name}}،\n\nتم استلام طلبك رقم {{order_number}}، وهو حاليًا تحت المراجعة.\n\nسيتم إشعارك فور اكتمال المراجعة أو عند الحاجة إلى معلومات إضافية.\n\nمتابعة الطلب:\n{{order_url}}"
  },
  {
    key: SALLA_TEMPLATE_KEYS.PROCESSING,
    name: "قيد التنفيذ",
    description: "إشعار العميل بأن تجهيز الطلب بدأ دون اختلاق وقت إنجاز.",
    triggerType: "order_status",
    icon: "settings",
    suggestedSlugs: ["in_progress", "processing", "under_processing"],
    variables: ["customer_name", "order_number", "store_name", "estimated_completion", "order_url"],
    body: "مرحبًا {{customer_name}}،\n\nبدأ تجهيز طلبك رقم {{order_number}} وهو الآن قيد التنفيذ.\n\n{{estimated_completion}}\n\nسيتم إشعارك فور اكتمال الطلب."
  },
  {
    key: SALLA_TEMPLATE_KEYS.COMPLETED,
    name: "تم التنفيذ",
    description: "رسالة واتساب معتمدة أو صفحة معلومات طلب آمنة خاصة بكل طلب.",
    triggerType: "order_status",
    icon: "check",
    suggestedSlugs: ["completed", "fulfilled"],
    variables: ["customer_name", "order_number", "service_name", "store_name", "completed_at", "renewal_url", "order_url"],
    body: "مرحبًا {{customer_name}} 👋\n\nتم تنفيذ طلبك رقم {{order_number}} بنجاح 🎉\n\nالخدمة: {{service_name}}\n\nيمكنك متابعة تفاصيل طلبك من:\n{{order_url}}\n\nشكرًا لثقتك في {{store_name}}.",
    settings: { completedDeliveryMode: "whatsapp_message", showSubscriptionDuration: true, visibleFields: ["order_number", "customer_name", "service_name", "starts_at", "expires_at", "remaining_days"] }
  },
  {
    key: SALLA_TEMPLATE_KEYS.SHIPPED,
    name: "تم الشحن",
    description: "إرسال بيانات شركة الشحن ورقم التتبع عند توفرهما فعليًا.",
    triggerType: "order_status",
    icon: "plane",
    suggestedSlugs: ["shipped"],
    variables: ["customer_name", "order_number", "shipping_company", "tracking_number", "tracking_url", "store_name"],
    body: "مرحبًا {{customer_name}}،\n\nتم شحن طلبك رقم {{order_number}}.\n\nشركة الشحن: {{shipping_company}}\nرقم التتبع: {{tracking_number}}\nتتبع الشحنة: {{tracking_url}}\n\nشكرًا لتسوقك معنا 💙"
  },
  {
    key: SALLA_TEMPLATE_KEYS.OUT_FOR_DELIVERY,
    name: "جاري التوصيل",
    description: "إشعار العميل بأن الشحنة في طريقها إليه دون وقت وصول غير مؤكد.",
    triggerType: "order_status",
    icon: "truck",
    suggestedSlugs: ["out_for_delivery", "delivering"],
    variables: ["customer_name", "order_number", "shipping_company", "tracking_number", "tracking_url", "delivery_note"],
    body: "مرحبًا {{customer_name}}،\n\nطلبك رقم {{order_number}} في طريقه إليك الآن.\n\nيمكنك متابعة الشحنة من:\n{{tracking_url}}"
  },
  {
    key: SALLA_TEMPLATE_KEYS.DELIVERED,
    name: "تم التوصيل",
    description: "رسالة شكر بعد تأكيد التسليم فعليًا مع إجراء اختياري.",
    triggerType: "order_status",
    icon: "package",
    suggestedSlugs: ["delivered"],
    variables: ["customer_name", "order_number", "delivered_at", "store_name", "support_url", "review_url", "optional_action"],
    body: "مرحبًا {{customer_name}}،\n\nتم توصيل طلبك رقم {{order_number}} بنجاح 🎉\n\nنتمنى أن تكون تجربتك رائعة.\n\n{{optional_action}}"
  },
  {
    key: SALLA_TEMPLATE_KEYS.RETURN_PENDING,
    name: "قيد الاسترجاع",
    description: "إشعار آمن باستلام طلب الاسترجاع ودخوله مرحلة المعالجة.",
    triggerType: "order_status",
    icon: "return",
    suggestedSlugs: ["return_pending", "returning"],
    variables: ["customer_name", "order_number", "return_number", "return_status", "return_url", "store_name"],
    body: "مرحبًا {{customer_name}}،\n\nتم استلام طلب الاسترجاع رقم {{return_number}} الخاص بطلبك رقم {{order_number}}.\n\nطلب الاسترجاع قيد المراجعة والمعالجة، وسيتم إشعارك عند تحديث حالته."
  },
  {
    key: SALLA_TEMPLATE_KEYS.RETURNED,
    name: "مسترجع",
    description: "تأكيد إتمام الاسترجاع مع بيانات مالية موثقة فقط.",
    triggerType: "order_status",
    icon: "refund",
    suggestedSlugs: ["returned", "refunded"],
    variables: ["customer_name", "order_number", "return_number", "refund_amount", "currency", "refund_method", "refund_type", "completed_at", "store_name"],
    body: "مرحبًا {{customer_name}} 👋\n\nتم إكمال طلب الاسترجاع رقم {{return_number}}.\n\n{{refund_summary}}\n\nشكرًا لتفهمك وثقتك بنا."
  },
  {
    key: SALLA_TEMPLATE_KEYS.INVOICE_READY,
    name: "إرسال الفاتورة",
    description: "صفحة فاتورة مستقلة بأرقام سلة الحقيقية وإرسال رابطها الآمن.",
    triggerType: "invoice_event",
    eventName: "invoice.created",
    icon: "invoice",
    variables: ["customer_name", "order_number", "invoice_number", "invoice_date", "amount", "currency", "invoice_url", "store_name"],
    body: "مرحبًا {{customer_name}}،\n\nفاتورتك رقم {{invoice_number}} جاهزة.\n\nيمكنك عرض الفاتورة وتفاصيل الدفع من:\n{{invoice_url}}\n\nفريق {{store_name}}",
    settings: { invoiceTrigger: "invoice.created", visibleFields: ["invoice_number", "order_number", "customer_name", "invoice_date", "items", "discounts", "tax", "shipping", "total", "payment_method", "payment_status", "store"] }
  }
];

export const SALLA_TEMPLATE_DEFINITIONS = Object.freeze(definitions.map((item) => Object.freeze(item)));
const definitionMap = new Map(definitions.map((item) => [item.key, item]));

function apiError(message, code = "SALLA_TEMPLATE_ERROR", status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function cleanSettings(input, current = {}) {
  const settings = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const delays = Array.isArray(settings.delaysMinutes)
    ? settings.delaysMinutes.slice(0, 3).map((item) => Math.max(5, Math.min(43200, Number(item) || 30)))
    : current.delaysMinutes;
  return {
    ...current,
    ...settings,
    ...(delays ? { delaysMinutes: delays } : {}),
    completedDeliveryMode: ["whatsapp_message", "secure_order_page"].includes(settings.completedDeliveryMode)
      ? settings.completedDeliveryMode : current.completedDeliveryMode,
    themeColor: /^#[0-9A-F]{6}$/i.test(settings.themeColor || "") ? settings.themeColor : (current.themeColor || "#2563EB")
  };
}

function rowPayload(row) {
  const definition = definitionMap.get(row.templateKey);
  return {
    ...row,
    name: definition?.name || row.templateKey,
    description: definition?.description || "",
    icon: definition?.icon || "template",
    variables: definition?.variables || [],
    settings: row.settings || {},
    requiresStatusMapping: definition?.triggerType === "order_status"
  };
}

async function sallaAccess(client, tenantId, userId = null, { lock = false } = {}) {
  const connection = await client.query(
    `SELECT id,tenant_id,status,readiness_status,provider_store_id,provider_store_name,
            access_token_encrypted,refresh_token_encrypted,token_expires_at
       FROM app_connections
      WHERE tenant_id=$1 AND provider='salla' AND status IN ('connected','ready')
      ORDER BY updated_at DESC LIMIT 1${lock ? " FOR UPDATE" : ""}`,
    [tenantId]
  );
  if (!connection.rows[0]) return { available: false, connection: null, roleAllowed: false };
  if (!userId) return { available: true, connection: connection.rows[0], roleAllowed: true };
  const member = await client.query(
    `SELECT COALESCE(tm.role,u.role) AS role
       FROM users u LEFT JOIN tenant_members tm ON tm.user_id=u.id AND tm.tenant_id=$1
      WHERE u.id=$2 AND u.tenant_id=$1 LIMIT 1`,
    [tenantId, userId]
  );
  const role = String(member.rows[0]?.role || "").toLowerCase();
  return { available: true, connection: connection.rows[0], roleAllowed: ["owner", "admin"].includes(role), role };
}

export async function ensureSallaAutomationTemplates(tenantId, connectionId = null) {
  return transaction(async (client) => {
    let id = connectionId;
    if (!id) {
      const access = await sallaAccess(client, tenantId);
      if (!access.available) return { ok: false, reason: "salla_not_connected" };
      id = access.connection.id;
    }
    for (const definition of definitions) {
      await client.query(
        `INSERT INTO tenant_salla_templates (
           tenant_id,salla_integration_id,template_key,trigger_type,salla_event_name,message_body,settings
         ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
         ON CONFLICT (tenant_id,template_key) DO UPDATE SET
           salla_integration_id=EXCLUDED.salla_integration_id,
           trigger_type=EXCLUDED.trigger_type,
           salla_event_name=COALESCE(tenant_salla_templates.salla_event_name,EXCLUDED.salla_event_name),
           updated_at=tenant_salla_templates.updated_at`,
        [tenantId, id, definition.key, definition.triggerType, definition.eventName || null,
          definition.body, JSON.stringify(definition.settings || {})]
      );
    }
    return { ok: true };
  });
}

export async function listSallaAutomationTemplates({ tenantId, userId }) {
  const access = await transaction((client) => sallaAccess(client, tenantId, userId));
  if (!access.available) return { available: false, roleAllowed: access.roleAllowed, items: [] };
  if (!access.roleAllowed) throw apiError("لا تملك صلاحية إدارة قوالب سلة.", "FORBIDDEN", 403);
  await ensureSallaAutomationTemplates(tenantId, access.connection.id);
  const result = await query(
    `SELECT id,template_key AS "templateKey",is_enabled AS "isEnabled",trigger_type AS "triggerType",
            salla_event_name AS "eventName",mapped_status_id AS "mappedStatusId",
            mapped_status_slug AS "mappedStatusSlug",mapped_status_name AS "mappedStatusName",
            delivery_channel AS channel,whatsapp_template_id AS "whatsappTemplateId",
            email_subject AS "emailSubject",message_body AS "messageBody",settings,version,
            last_sent_at AS "lastSentAt",last_failure_at AS "lastFailureAt",
            last_failure_code AS "lastFailureCode",updated_at AS "updatedAt"
       FROM tenant_salla_templates WHERE tenant_id=$1 ORDER BY created_at`,
    [tenantId]
  );
  return {
    available: true,
    roleAllowed: true,
    integration: {
      id: access.connection.id,
      status: access.connection.status,
      readinessStatus: access.connection.readiness_status,
      storeName: access.connection.provider_store_name
    },
    items: result.rows.map(rowPayload)
  };
}

export async function getSallaAutomationTemplate({ tenantId, userId, templateKey }) {
  if (!definitionMap.has(templateKey)) throw apiError("قالب سلة غير معروف.", "TEMPLATE_NOT_FOUND", 404);
  const payload = await listSallaAutomationTemplates({ tenantId, userId });
  if (!payload.available) return payload;
  const item = payload.items.find((template) => template.templateKey === templateKey);
  const [statuses, metaTemplates] = await Promise.all([
    query(`SELECT external_status_id AS id,status_slug AS slug,status_name AS name,is_custom AS "isCustom"
             FROM salla_order_statuses WHERE tenant_id=$1 AND is_active=true ORDER BY status_name`, [tenantId]),
    query(`SELECT id,template_name AS name,display_name AS "displayName",language,local_status AS status
             FROM meta_message_templates
            WHERE tenant_id=$1 AND local_status='approved' AND deleted_at IS NULL ORDER BY updated_at DESC`, [tenantId])
  ]);
  return { ...payload, item, statuses: statuses.rows, metaTemplates: metaTemplates.rows };
}

export async function saveSallaAutomationTemplate({ tenantId, userId, templateKey, input }) {
  const definition = definitionMap.get(templateKey);
  if (!definition) throw apiError("قالب سلة غير معروف.", "TEMPLATE_NOT_FOUND", 404);
  const channel = input.channel == null || input.channel === "" ? null : String(input.channel);
  if (channel && !["whatsapp", "email"].includes(channel)) throw apiError("قناة الإرسال غير صالحة.", "INVALID_CHANNEL");
  const body = String(input.messageBody || "").trim().slice(0, 10000);
  if (!body) throw apiError("محتوى الرسالة مطلوب.", "MESSAGE_REQUIRED");
  const access = await transaction((client) => sallaAccess(client, tenantId, userId, { lock: true }));
  if (!access.available) throw apiError("اربط متجر سلة أولًا.", "SALLA_NOT_CONNECTED", 409);
  if (!access.roleAllowed) throw apiError("لا تملك صلاحية إدارة قوالب سلة.", "FORBIDDEN", 403);
  await ensureSallaAutomationTemplates(tenantId, access.connection.id);
  const current = await query("SELECT settings FROM tenant_salla_templates WHERE tenant_id=$1 AND template_key=$2", [tenantId, templateKey]);
  const settings = cleanSettings(input.settings, current.rows[0]?.settings || definition.settings || {});
  const result = await query(
    `UPDATE tenant_salla_templates SET
       delivery_channel=$3,whatsapp_template_id=$4,email_subject=$5,message_body=$6,
       mapped_status_id=$7,mapped_status_slug=$8,mapped_status_name=$9,settings=$10::jsonb,
       version=version+1,updated_at=now()
     WHERE tenant_id=$1 AND template_key=$2
     RETURNING id,template_key AS "templateKey",is_enabled AS "isEnabled",trigger_type AS "triggerType",
       salla_event_name AS "eventName",mapped_status_id AS "mappedStatusId",
       mapped_status_slug AS "mappedStatusSlug",mapped_status_name AS "mappedStatusName",
       delivery_channel AS channel,whatsapp_template_id AS "whatsappTemplateId",
       email_subject AS "emailSubject",message_body AS "messageBody",settings,version,updated_at AS "updatedAt"`,
    [tenantId, templateKey, channel, input.whatsappTemplateId || null,
      String(input.emailSubject || "").trim().slice(0, 300) || null, body,
      input.mappedStatusId || null, input.mappedStatusSlug || null, input.mappedStatusName || null,
      JSON.stringify(settings)]
  );
  await query(
    `INSERT INTO activity_logs (tenant_id,user_id,type,title,metadata)
     VALUES ($1,$2,'salla_template.updated','Salla template updated',$3::jsonb)`,
    [tenantId, userId, JSON.stringify({ templateKey, version: result.rows[0].version })]
  );
  return rowPayload(result.rows[0]);
}

export async function validateSallaAutomationTemplate({ tenantId, userId, templateKey }) {
  const payload = await getSallaAutomationTemplate({ tenantId, userId, templateKey });
  if (!payload.available) return { ok: false, errors: ["تكامل سلة غير متصل."] };
  const item = payload.item;
  const errors = [];
  if (!item.channel) errors.push("لم يتم تحديد قناة الإرسال.");
  if (item.requiresStatusMapping && !item.mappedStatusId) errors.push("لم يتم ربط حالة سلة.");
  if (!String(item.messageBody || "").trim()) errors.push("محتوى الرسالة مفقود.");
  if (item.channel === "whatsapp") {
    if (!item.whatsappTemplateId) errors.push("قالب واتساب المعتمد غير محدد.");
    const selected = payload.metaTemplates.find((template) => template.id === item.whatsappTemplateId);
    if (!selected || selected.status !== "approved") errors.push("قالب واتساب غير معتمد.");
    const connected = await query(
      `SELECT id FROM whatsapp_channels WHERE tenant_id=$1
        AND provider IN ('meta','meta_cloud_api') AND status='connected' LIMIT 1`,
      [tenantId]
    );
    if (!connected.rows[0]) errors.push("تكامل Meta غير متصل.");
  }
  if (item.channel === "email") {
    if (!String(item.emailSubject || "").trim()) errors.push("عنوان البريد مفقود.");
    if (!process.env.RESEND_API_KEY) errors.push("خدمة البريد غير مهيأة.");
  }
  if (templateKey === SALLA_TEMPLATE_KEYS.COMPLETED
      && item.settings?.completedDeliveryMode === "secure_order_page"
      && !item.settings?.visibleFields?.length) errors.push("حقول صفحة معلومات الطلب غير محددة.");
  return { ok: errors.length === 0, errors };
}

export async function setSallaAutomationTemplateEnabled({ tenantId, userId, templateKey, enabled }) {
  if (enabled) {
    const validation = await validateSallaAutomationTemplate({ tenantId, userId, templateKey });
    if (!validation.ok) return validation;
  } else {
    const access = await transaction((client) => sallaAccess(client, tenantId, userId));
    if (!access.available) throw apiError("تكامل سلة غير متصل.", "SALLA_NOT_CONNECTED", 409);
    if (!access.roleAllowed) throw apiError("لا تملك الصلاحية.", "FORBIDDEN", 403);
  }
  const result = await query(
    `UPDATE tenant_salla_templates SET is_enabled=$3,updated_at=now()
      WHERE tenant_id=$1 AND template_key=$2 RETURNING id,is_enabled AS "isEnabled"`,
    [tenantId, templateKey, Boolean(enabled)]
  );
  return { ok: Boolean(result.rows[0]), item: result.rows[0] || null, errors: [] };
}

export function renderSallaTemplate(body, variables = {}) {
  return String(body || "")
    .replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, key) => String(variables[key] ?? ""))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function previewSallaAutomationTemplate(item, variables = {}) {
  const demo = {
    customer_name: "أحمد",
    store_name: "متجرك",
    order_number: "#10025",
    service_name: "الخدمة المطلوبة",
    estimated_completion: "الوقت المتوقع الموثق سيظهر هنا عند توفره.",
    order_url: "https://renvix.app/o/preview?t=preview",
    renewal_url: "https://renvix.app/r/preview",
    shipping_company: "شركة الشحن",
    tracking_number: "TRK-10025",
    tracking_url: "https://tracking.example/preview",
    return_number: "RTN-1001",
    refund_summary: "تظهر تفاصيل الاسترداد هنا فقط بعد تأكيدها ماليًا.",
    invoice_number: "INV-10025",
    invoice_url: "https://renvix.app/i/preview?t=preview",
    cart_items: "منتجان",
    checkout_url: "https://store.example/cart/preview",
    optional_action: "يسعدنا تقييم تجربتك.",
    ...variables
  };
  return {
    channel: item.channel,
    subject: item.emailSubject ? renderSallaTemplate(item.emailSubject, demo) : null,
    body: renderSallaTemplate(item.messageBody, demo),
    notice: "معاينة فقط — لن يتم إرسال أي رسالة"
  };
}

function flattenStatuses(payload) {
  const root = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.data?.data) ? payload.data.data : [];
  const result = [];
  const walk = (items, custom = false) => {
    for (const item of items || []) {
      const id = String(item.id ?? item.status_id ?? "").trim();
      const name = String(item.name ?? item.status?.name ?? "").trim();
      if (id && name) result.push({
        id,
        slug: String(item.slug ?? item.status?.slug ?? "").trim() || null,
        name,
        isCustom: Boolean(item.is_custom ?? item.custom ?? custom)
      });
      walk(item.children || item.sub_statuses || [], Boolean(item.is_custom ?? custom));
    }
  };
  walk(root);
  return result;
}

export async function syncSallaOrderStatuses({ tenantId, userId }) {
  const access = await transaction((client) => sallaAccess(client, tenantId, userId));
  if (!access.available) throw apiError("اربط متجر سلة أولًا.", "SALLA_NOT_CONNECTED", 409);
  if (!access.roleAllowed) throw apiError("لا تملك الصلاحية.", "FORBIDDEN", 403);
  const token = await getSallaAccessToken(access.connection);
  const base = (process.env.SALLA_API_BASE_URL || "https://api.salla.dev/admin/v2").replace(/\/$/, "");
  const response = await fetch(`${base}/orders/statuses`, { headers: { authorization: `Bearer ${token}`, accept: "application/json" } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw apiError(`تعذر جلب حالات سلة (${response.status}).`, "SALLA_STATUS_SYNC_FAILED", 502);
  const statuses = flattenStatuses(payload);
  await transaction(async (client) => {
    for (const status of statuses) {
      await client.query(
        `INSERT INTO salla_order_statuses (
           tenant_id,salla_integration_id,external_status_id,status_slug,status_name,is_custom
         ) VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (salla_integration_id,external_status_id) DO UPDATE SET
           tenant_id=EXCLUDED.tenant_id,status_slug=EXCLUDED.status_slug,status_name=EXCLUDED.status_name,
           is_custom=EXCLUDED.is_custom,is_active=true,synced_at=now()`,
        [tenantId, access.connection.id, status.id, status.slug, status.name, status.isCustom]
      );
    }
    for (const definition of definitions.filter((item) => item.triggerType === "order_status")) {
      const suggested = statuses.find((status) => definition.suggestedSlugs?.includes(String(status.slug || "").toLowerCase()));
      if (suggested) {
        await client.query(
          `UPDATE tenant_salla_templates SET mapped_status_id=COALESCE(mapped_status_id,$3),
             mapped_status_slug=COALESCE(mapped_status_slug,$4),mapped_status_name=COALESCE(mapped_status_name,$5),
             updated_at=now()
           WHERE tenant_id=$1 AND template_key=$2`,
          [tenantId, definition.key, suggested.id, suggested.slug, suggested.name]
        );
      }
    }
  });
  return { ok: true, count: statuses.length };
}

export async function listSallaOrderStatuses({ tenantId, userId }) {
  const access = await transaction((client) => sallaAccess(client, tenantId, userId));
  if (!access.available) return { available: false, items: [] };
  if (!access.roleAllowed) throw apiError("لا تملك الصلاحية.", "FORBIDDEN", 403);
  const result = await query(
    `SELECT external_status_id AS id,status_slug AS slug,status_name AS name,is_custom AS "isCustom",
            synced_at AS "syncedAt" FROM salla_order_statuses
      WHERE tenant_id=$1 AND is_active=true ORDER BY status_name`,
    [tenantId]
  );
  return { available: true, items: result.rows };
}

export function normalizeSallaTemplateEvent(payload) {
  const data = payload?.data || {};
  const merchant = payload?.merchant;
  return {
    eventName: String(payload?.event || payload?.type || "unknown"),
    externalEventId: String(payload?.id || data?.event_id || "").trim() || null,
    storeId: String((merchant && typeof merchant === "object" ? merchant.id : merchant)
      || payload?.merchant_id || data?.merchant?.id || data?.store?.id || "").trim(),
    merchantId: String(data?.merchant?.id || "").trim() || null,
    orderId: String(data?.order?.id || data?.order_id || (String(payload?.event || "").startsWith("order.") ? data?.id : "") || "").trim() || null,
    cartId: String(data?.cart?.id || data?.cart_id || (String(payload?.event || "").includes("cart") ? data?.id : "") || "").trim() || null,
    invoiceId: String(data?.invoice?.id || data?.invoice_id || (payload?.event === "invoice.created" ? data?.id : "") || "").trim() || null,
    returnId: String(data?.return?.id || data?.return_id || "").trim() || null,
    statusId: String(data?.status?.id || data?.status_id || "").trim() || null,
    statusSlug: String(data?.status?.slug || data?.status_slug || "").trim() || null,
    occurredAt: new Date(payload?.created_at || data?.created_at || Date.now())
  };
}

export async function processSallaTemplateEvent(payload) {
  const normalized = normalizeSallaTemplateEvent(payload);
  if (!normalized.storeId) return { status: "ignored", reason: "store_missing" };
  const connection = await query(
    `SELECT id,tenant_id FROM app_connections
      WHERE provider='salla' AND provider_store_id=$1 AND status IN ('connected','ready') LIMIT 1`,
    [normalized.storeId]
  );
  if (!connection.rows[0]) return { status: "ignored", reason: "connection_missing" };
  const tenantId = connection.rows[0].tenant_id;
  await ensureSallaAutomationTemplates(tenantId, connection.rows[0].id);
  if (normalized.cartId && normalized.orderId && normalized.eventName.startsWith("order.")) {
    await transaction(async (client) => {
      await client.query(
        `UPDATE abandoned_cart_sequences
            SET status='converted',converted_order_id=$3,cancelled_at=now(),updated_at=now()
          WHERE tenant_id=$1 AND external_cart_id=$2 AND status='active'`,
        [tenantId, normalized.cartId, normalized.orderId]
      );
      await client.query(
        `UPDATE message_queue queue SET status='cancelled',last_error='abandoned_cart_converted',updated_at=now()
          FROM salla_template_deliveries delivery
         WHERE delivery.message_queue_id=queue.id AND delivery.tenant_id=$1
           AND delivery.external_cart_id=$2 AND queue.status='pending'`,
        [tenantId, normalized.cartId]
      );
      await client.query(
        `UPDATE salla_template_deliveries SET status='skipped',failure_code='cart_converted',updated_at=now()
          WHERE tenant_id=$1 AND external_cart_id=$2 AND status='queued'`,
        [tenantId, normalized.cartId]
      );
    });
  }
  const candidates = await query(
    `SELECT * FROM tenant_salla_templates WHERE tenant_id=$1 AND is_enabled=true
      AND (
        (trigger_type='abandoned_cart' AND $2='abandoned.cart')
        OR (trigger_type='invoice_event' AND salla_event_name=$2)
        OR (trigger_type='order_status' AND (
          mapped_status_id=$3 OR (mapped_status_slug IS NOT NULL AND mapped_status_slug=$4)
        ))
      )`,
    [tenantId, normalized.eventName, normalized.statusId, normalized.statusSlug]
  );
  if (!candidates.rows.length) return { status: "skipped", reason: "template_disabled_or_unmapped" };
  const data = payload?.data || {};
  let queued = 0;
  for (const template of candidates.rows) {
    if (template.trigger_type === "abandoned_cart" && normalized.cartId) {
      await query(
        `INSERT INTO abandoned_cart_sequences (tenant_id,template_id,external_cart_id,status)
         VALUES ($1,$2,$3,'active')
         ON CONFLICT (tenant_id,external_cart_id) DO UPDATE SET
           template_id=EXCLUDED.template_id,updated_at=now()`,
        [tenantId, template.id, normalized.cartId]
      );
    }
    const transition = normalized.externalEventId || `${normalized.statusId || normalized.statusSlug || normalized.eventName}:${normalized.occurredAt.toISOString()}`;
    const idempotencyKey = template.trigger_type === "abandoned_cart"
      ? `salla:cart:${tenantId}:${normalized.cartId}:1`
      : template.trigger_type === "invoice_event"
        ? `salla:invoice:${tenantId}:${normalized.invoiceId}`
        : template.template_key.includes("return")
          ? `salla:return:${tenantId}:${normalized.returnId || normalized.orderId}:${normalized.statusId || normalized.statusSlug}`
          : `salla:order-status:${tenantId}:${normalized.orderId}:${normalized.statusId || normalized.statusSlug}:${transition}`;
    const customer = data.customer || data.order?.customer || {};
    const recipient = template.delivery_channel === "email" ? customer.email : (customer.mobile || customer.phone);
    if (!recipient) continue;
    const recipientHash = crypto.createHash("sha256").update(`${tenantId}:${recipient}`).digest("hex");
    const inserted = await query(
      `INSERT INTO salla_template_deliveries (
         tenant_id,template_id,template_key,external_event_id,external_order_id,external_cart_id,
         external_invoice_id,external_return_id,channel,recipient_hash,idempotency_key,status
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'queued')
       ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`,
      [tenantId, template.id, template.template_key, normalized.externalEventId,
        normalized.orderId, normalized.cartId, normalized.invoiceId, normalized.returnId,
        template.delivery_channel, recipientHash, idempotencyKey]
    );
    if (!inserted.rows[0]) continue;
    const variables = {
      customer_name: customer.name || [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "عميلنا",
      store_name: data.store?.name || data.merchant?.name || "",
      order_number: data.order?.reference_id || data.reference_id || normalized.orderId || "",
      cart_total: data.total?.amount || data.total || "",
      currency: data.currency || data.total?.currency || "SAR",
      items_count: data.items?.length || "",
      cart_items: Array.isArray(data.items) ? data.items.map((item) => item.name).filter(Boolean).join("، ") : "",
      checkout_url: data.checkout_url || data.url || "",
      shipping_company: data.shipment?.company || data.shipping?.company || "",
      tracking_number: data.shipment?.tracking_number || data.tracking_number || "",
      tracking_url: data.shipment?.tracking_link || data.tracking_url || "",
      return_number: data.return?.reference_id || normalized.returnId || "",
      invoice_number: data.invoice?.number || data.number || normalized.invoiceId || "",
      invoice_date: data.invoice?.date || data.created_at || "",
      amount: data.total?.amount || "",
      refund_amount: data.refund?.amount || "",
      refund_method: data.refund?.method || "",
      refund_type: data.refund?.type || "",
      refund_summary: data.refund?.confirmed === true ? `${data.refund.amount || ""} ${data.refund.currency || data.currency || ""}` : ""
    };
    const pageType = template.template_key === SALLA_TEMPLATE_KEYS.INVOICE_READY
      ? "invoice"
      : template.template_key === SALLA_TEMPLATE_KEYS.COMPLETED
          && template.settings?.completedDeliveryMode === "secure_order_page"
        ? "order"
        : null;
    let publicPage = null;
    if (pageType) {
      const externalEntityId = pageType === "invoice" ? normalized.invoiceId : normalized.orderId;
      publicPage = await getOrCreateSallaPublicPage({
        tenantId,
        templateId: template.id,
        pageType,
        externalEntityId,
        source: {
          ...data,
          order: data.order || (normalized.orderId ? { id: normalized.orderId } : {}),
          invoice: data.invoice || (normalized.invoiceId ? { id: normalized.invoiceId } : {}),
          branding: template.settings?.branding || {}
        },
        branding: template.settings?.branding || {},
        expiresInDays: template.settings?.linkExpiresInDays || 365
      });
      if (!publicPage.ok) {
        await query(
          `UPDATE salla_template_deliveries
              SET status='failed',failed_at=now(),failure_code=$2,
                  failure_message_safe='تعذر إنشاء الرابط الآمن.',updated_at=now()
            WHERE id=$1`,
          [inserted.rows[0].id, publicPage.reason]
        );
        continue;
      }
      if (pageType === "invoice") variables.invoice_url = publicPage.url;
      else variables.order_url = publicPage.url;
      await query(
        `UPDATE salla_template_deliveries
            SET public_page_type=$2,public_page_id=$3,updated_at=now()
          WHERE id=$1`,
        [inserted.rows[0].id, pageType, publicPage.id]
      );
    }
    const channel = await query(
      `SELECT id FROM whatsapp_channels WHERE tenant_id=$1 AND provider IN ('meta','meta_cloud_api')
        AND status='connected' ORDER BY updated_at DESC LIMIT 1`,
      [tenantId]
    );
    const queueResult = await enqueueMessage({
      tenantId,
      whatsappChannelId: template.delivery_channel === "whatsapp" ? channel.rows[0]?.id : null,
      templateId: null,
      templateSnapshot: template.whatsapp_template_id ? {
        provider: "meta",
        metaTemplateId: template.whatsapp_template_id,
        sallaTemplateKey: template.template_key
      } : {
        provider: "resend",
        sallaTemplateKey: template.template_key
      },
      channelType: template.delivery_channel,
      messageType: "salla_template",
      destination: recipient,
      emailTo: template.delivery_channel === "email" ? recipient : null,
      subject: template.email_subject ? renderSallaTemplate(template.email_subject, variables) : null,
      messageBody: renderSallaTemplate(template.message_body, variables),
      referenceType: "salla_template_delivery",
      referenceId: inserted.rows[0].id,
      triggerKey: idempotencyKey,
      sourceMode: "automatic",
      enforceConnected: template.delivery_channel === "whatsapp"
    });
    if (queueResult.ok) {
      const firstAbandonedDelay = template.trigger_type === "abandoned_cart"
        ? Math.max(5, Number(template.settings?.delaysMinutes?.[0]) || 30)
        : 0;
      await transaction(async (client) => {
        if (firstAbandonedDelay) {
          await client.query(
            `UPDATE message_queue
                SET scheduled_for=now()+($2::text || ' minutes')::interval,updated_at=now()
              WHERE id=$1`,
            [queueResult.queueId, firstAbandonedDelay]
          );
        }
        await client.query(
          `UPDATE salla_template_deliveries
              SET message_queue_id=$2,queued_at=now(),updated_at=now()
            WHERE id=$1`,
          [inserted.rows[0].id, queueResult.queueId]
        );
      });
      queued += 1;
      if (template.trigger_type === "abandoned_cart") {
        const delays = Array.isArray(template.settings?.delaysMinutes)
          ? template.settings.delaysMinutes.slice(1, Math.max(1, Number(template.settings?.maxMessages || 3)))
          : [1440, 4320];
        for (const [offset, delayMinutes] of delays.entries()) {
          const messageIndex = offset + 2;
          const followupKey = `salla:cart:${tenantId}:${normalized.cartId}:${messageIndex}`;
          const followup = await query(
            `INSERT INTO salla_template_deliveries (
               tenant_id,template_id,template_key,external_event_id,external_cart_id,channel,
               recipient_hash,idempotency_key,status
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'queued')
             ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`,
            [tenantId, template.id, template.template_key, normalized.externalEventId,
              normalized.cartId, template.delivery_channel, recipientHash, followupKey]
          );
          if (!followup.rows[0]) continue;
          const followupQueue = await enqueueMessage({
            tenantId,
            whatsappChannelId: template.delivery_channel === "whatsapp" ? channel.rows[0]?.id : null,
            templateId: null,
            templateSnapshot: template.whatsapp_template_id ? {
              provider: "meta",
              metaTemplateId: template.whatsapp_template_id,
              sallaTemplateKey: template.template_key,
              abandonedCartMessageIndex: messageIndex
            } : {
              provider: "resend",
              sallaTemplateKey: template.template_key,
              abandonedCartMessageIndex: messageIndex
            },
            channelType: template.delivery_channel,
            messageType: "salla_template",
            destination: recipient,
            emailTo: template.delivery_channel === "email" ? recipient : null,
            subject: template.email_subject ? renderSallaTemplate(template.email_subject, variables) : null,
            messageBody: renderSallaTemplate(template.message_body, variables),
            referenceType: "salla_template_delivery",
            referenceId: followup.rows[0].id,
            triggerKey: followupKey,
            sourceMode: "automatic",
            enforceConnected: template.delivery_channel === "whatsapp"
          });
          if (followupQueue.ok) {
            await transaction(async (client) => {
              await client.query(
                `UPDATE message_queue SET scheduled_for=now()+($2::text || ' minutes')::interval,updated_at=now()
                  WHERE id=$1`,
                [followupQueue.queueId, Math.max(5, Number(delayMinutes) || 30)]
              );
              await client.query(
                `UPDATE salla_template_deliveries SET message_queue_id=$2,queued_at=now(),updated_at=now()
                  WHERE id=$1`,
                [followup.rows[0].id, followupQueue.queueId]
              );
            });
            queued += 1;
          } else {
            await query(
              `UPDATE salla_template_deliveries SET status='failed',failed_at=now(),failure_code=$2,
                 failure_message_safe='تعذر جدولة رسالة السلة المتروكة.',updated_at=now() WHERE id=$1`,
              [followup.rows[0].id, followupQueue.reason]
            );
          }
        }
      }
    } else {
      await query(
        `UPDATE salla_template_deliveries SET status='failed',failed_at=now(),failure_code=$2,
           failure_message_safe=$3,updated_at=now() WHERE id=$1`,
        [inserted.rows[0].id, queueResult.reason, "تعذر وضع الرسالة في قائمة الإرسال."]
      );
    }
  }
  return { status: "processed", queued };
}

export async function listSallaTemplateDeliveries({ tenantId, userId, limit = 50 }) {
  const access = await transaction((client) => sallaAccess(client, tenantId, userId));
  if (!access.available) return { available: false, items: [] };
  if (!access.roleAllowed) throw apiError("لا تملك الصلاحية.", "FORBIDDEN", 403);
  const result = await query(
    `SELECT id,template_key AS "templateKey",external_order_id AS "externalOrderId",
            external_cart_id AS "externalCartId",external_invoice_id AS "externalInvoiceId",
            channel,status,provider_message_id AS "providerMessageId",queued_at AS "queuedAt",
            sent_at AS "sentAt",delivered_at AS "deliveredAt",read_at AS "readAt",
            failed_at AS "failedAt",failure_code AS "failureCode",created_at AS "createdAt"
       FROM salla_template_deliveries WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT $2`,
    [tenantId, Math.max(1, Math.min(200, Number(limit) || 50))]
  );
  return { available: true, items: result.rows };
}
