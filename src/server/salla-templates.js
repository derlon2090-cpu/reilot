import crypto from "node:crypto";
import { query, transaction } from "./db.js";
import { getSallaAccessToken } from "./salla-app.js";
import { enqueueMessage } from "./message-queue.js";
import { getOrCreateSallaPublicPage, revokeSallaPublicPages } from "./salla-public-pages.js";
import { createInAppNotification } from "./in-app-notifications.js";
import {
  classifyAmbiguousDeliveryContent,
  deliveryContentHash,
  extractTrustedDeliveryContent,
  parseSmartDeliveryContent
} from "./smart-delivery-content.js";
import { durationWindow, resolveProductDurationWithDeepSeek } from "./product-duration-resolver.js";

export const SALLA_TEMPLATE_KEYS = Object.freeze({
  DIGITAL_PRODUCT_DELIVERY: "digital_product_delivery",
  PROCESSING: "processing",
  UNDER_REVIEW: "under_review",
  DELIVERED: "delivered",
  OUT_FOR_DELIVERY: "out_for_delivery",
  COMPLETED: "completed",
  REVIEW_REQUEST: "review_request",
  ABANDONED_CART: "abandoned_cart",
  CANCELLED: "cancelled",
  RETURN_IN_PROGRESS: "return_in_progress",
  RETURNED: "returned",
  SHIPPED: "shipped"
});

const definitions = [
  {
    key: SALLA_TEMPLATE_KEYS.DIGITAL_PRODUCT_DELIVERY,
    name: "إرسال المنتجات الرقمية",
    description: "إنشاء صفحة تسليم آمنة من الحقل المعتمد عند انتقال الطلب فعليًا إلى تم التنفيذ.",
    triggerType: "order_status",
    suggestedSlugs: ["completed", "fulfilled"],
    icon: "download",
    previewAction: "استلام المنتج",
    variables: ["customer_name", "order_number", "product_name", "digital_content_url", "store_name", "duration_days"],
    body: "مرحبًا {{customer_name}} 👋\n\nأصبحت معلومات تسليم طلبك رقم {{order_number}} جاهزة.\nلأمان بياناتك، اعرضها من الرابط الآمن التالي فقط:\n{{digital_content_url}}",
    emailSubject: "تفاصيل منتجك الرقمي جاهزة للاستلام",
    settings: {
      secureLinkEnabled: true,
      showDuration: false,
      linkPageTitle: "منتجاتك الرقمية جاهزة",
      linkPageContent: "استخدم البيانات التالية للوصول إلى منتجك الرقمي بأمان."
    }
  },
  {
    key: SALLA_TEMPLATE_KEYS.PROCESSING,
    name: "قيد التنفيذ",
    description: "إشعار العميل بأن تجهيز الطلب بدأ دون اختلاق وقت إنجاز.",
    triggerType: "order_status",
    icon: "settings",
    suggestedSlugs: ["in_progress", "processing", "under_processing"],
    variables: ["customer_name", "order_number", "store_name", "estimated_completion", "order_url"],
    previewAction: "عرض حالة الطلب",
    body: "مرحبًا {{customer_name}} 👋\n\nنود إبلاغك بأن طلبك رقم {{order_number}} قيد التنفيذ حاليًا.\nنحن نقوم بتجهيز طلبك بعناية، وسنقوم بإشعارك فور شحنه.\n\nشكرًا لثقتك بنا.",
    emailSubject: "طلبك قيد التنفيذ"
  },
  {
    key: SALLA_TEMPLATE_KEYS.UNDER_REVIEW,
    name: "تحت المراجعة",
    description: "إعلام العميل بأن طلبه قيد المراجعة من قبل الفريق المختص.",
    triggerType: "order_status",
    icon: "clock",
    previewAction: "عرض التفاصيل",
    suggestedSlugs: ["under_review", "reviewing", "pending_review"],
    variables: ["customer_name", "order_number", "store_name", "order_url", "review_note"],
    body: "مرحبًا {{customer_name}} 👋\n\nنود إبلاغك بأن طلبك رقم {{order_number}} تحت المراجعة من قبل فريقنا المختص حاليًا.\nسنوافيك بأي تحديث في أقرب وقت ممكن.\n\nشكرًا لتفهمك وثقتك بنا.",
    emailSubject: "تحديث بشأن طلبك رقم {{order_number}}"
  },
  {
    key: SALLA_TEMPLATE_KEYS.DELIVERED,
    name: "تم التوصيل",
    description: "إشعار العميل عند تأكيد تسليم الطلب بنجاح.",
    triggerType: "order_status",
    icon: "package",
    previewAction: "عرض الطلب",
    suggestedSlugs: ["delivered"],
    variables: ["customer_name", "order_number", "delivered_at", "store_name", "support_url", "review_url", "order_url"],
    body: "مرحبًا {{customer_name}} 👋\n\nنحيطك علمًا بأن طلبك رقم {{order_number}} تم تسليمه بنجاح.\nشكرًا لتسوقك معنا، ونتطلع لخدمتك مرة أخرى.",
    emailSubject: "تم تسليم طلبك بنجاح"
  },
  {
    key: SALLA_TEMPLATE_KEYS.OUT_FOR_DELIVERY,
    name: "جاري التوصيل",
    description: "إشعار العميل بأن الشحنة في طريقها إليه دون وقت وصول غير مؤكد.",
    triggerType: "order_status",
    icon: "truck",
    suggestedSlugs: ["out_for_delivery", "delivering"],
    variables: ["customer_name", "order_number", "shipping_company", "tracking_number", "tracking_url", "delivery_note"],
    previewAction: "تتبع الطلب",
    body: "مرحبًا {{customer_name}}،\n\nطلبك رقم {{order_number}} في طريقه إليك الآن 🚚\nيمكنك تتبع حالة الطلب ومعرفة موقعه من الرابط الآمن.\n\nموعد الوصول المتوقع: {{delivery_date}}",
    emailSubject: "طلبك في الطريق إليك"
  },
  {
    key: SALLA_TEMPLATE_KEYS.COMPLETED,
    name: "تم التنفيذ",
    description: "إرسال رسالة نجاح تتضمن رابط صفحة معلومات الطلب الآمنة.",
    triggerType: "order_status",
    icon: "check",
    previewAction: "استعراض الطلب",
    suggestedSlugs: ["completed", "fulfilled"],
    variables: ["customer_name", "order_number", "service_name", "store_name", "completed_at", "order_url"],
    body: "تم تنفيذ طلبك بنجاح ✅\n\nمرحبًا {{customer_name}}،\nنود إبلاغك بأن طلبك رقم {{order_number}} قد تم تنفيذه بنجاح.\n\nيمكنك استعراض تفاصيل الطلب من الرابط الآمن:\n{{order_url}}",
    emailSubject: "تم تنفيذ طلبك بنجاح",
    settings: { completedDeliveryMode: "secure_order_page", showSubscriptionDuration: true, visibleFields: ["order_number", "customer_name", "service_name", "starts_at", "expires_at", "remaining_days"] }
  },
  {
    key: SALLA_TEMPLATE_KEYS.REVIEW_REQUEST,
    name: "طلب تقييم",
    description: "طلب تقييم تجربة العميل بعد التسليم بمهلة قابلة للضبط.",
    triggerType: "order_status",
    icon: "star",
    previewAction: "قيّم تجربتك",
    suggestedSlugs: ["delivered", "completed"],
    variables: ["customer_name", "order_number", "store_name", "rating_url"],
    body: "مرحبًا {{customer_name}} 👋\n\nشكرًا لك على طلبك رقم {{order_number}} من {{store_name}}.\nنتمنى أن تكون تجربتك معنا رائعة.\n\nشاركنا تقييمك وملاحظاتك لمساعدتنا على تحسين خدماتنا:\n{{rating_url}}",
    emailSubject: "شاركنا تقييم تجربتك",
    settings: { reviewDelayMinutes: 1440 }
  },
  {
    key: SALLA_TEMPLATE_KEYS.ABANDONED_CART,
    name: "السلات المتروكة",
    description: "تذكير العميل بسلة لم تكتمل مع إيقاف التسلسل فور إتمام الشراء.",
    triggerType: "abandoned_cart",
    eventName: "abandoned.cart",
    icon: "cart",
    previewAction: "إكمال الطلب",
    variables: ["customer_name", "store_name", "cart_total", "currency", "items_count", "cart_items", "checkout_url"],
    body: "مرحبًا {{customer_name}} 👋\n\nلاحظنا أنك لم تكمل طلبك رقم {{order_number}} بعد، ولا تزال منتجاتك في انتظارك.\n\nيمكنك العودة لإكمال طلبك بسهولة من هنا:\n{{checkout_url}}",
    emailSubject: "لا تنسَ إكمال طلبك — منتجاتك لا تزال في سلتك",
    settings: { delaysMinutes: [30, 1440, 4320], maxMessages: 3, stopOnConversion: true }
  },
  {
    key: SALLA_TEMPLATE_KEYS.CANCELLED,
    name: "ملغي",
    description: "إشعار العميل عند إلغاء الطلب مع عرض السبب عند توفره.",
    triggerType: "event",
    eventName: "order.cancelled",
    icon: "cancel",
    previewAction: "عرض الطلب",
    variables: ["customer_name", "order_number", "cancellation_reason", "store_name", "order_url"],
    body: "مرحبًا {{customer_name}}،\n\nنود إبلاغك بأن طلبك رقم {{order_number}} قد تم إلغاؤه.\nسبب الإلغاء: {{cancellation_reason}}\n\nإذا كان لديك أي استفسار يرجى التواصل معنا.",
    emailSubject: "تم إلغاء طلبك"
  },
  {
    key: SALLA_TEMPLATE_KEYS.RETURN_IN_PROGRESS,
    name: "قيد الاسترجاع",
    description: "إشعار آمن باستلام طلب الاسترجاع ودخوله مرحلة المعالجة.",
    triggerType: "event",
    eventName: "order.return.created",
    icon: "return",
    previewAction: "عرض تفاصيل الاسترجاع",
    variables: ["customer_name", "order_number", "return_number", "return_status", "return_url", "store_name"],
    body: "مرحبًا {{customer_name}}،\n\nتم استلام طلب الاسترجاع الخاص بطلبك رقم {{order_number}}، وهو الآن قيد المعالجة.\nسنوافيك بالتحديثات بمجرد انتهاء المراجعة.\n\n{{return_url}}",
    emailSubject: "طلب الاسترجاع قيد المعالجة"
  },
  {
    key: SALLA_TEMPLATE_KEYS.RETURNED,
    name: "مسترجع",
    description: "تأكيد إتمام الاسترجاع مع بيانات مالية موثقة فقط.",
    triggerType: "event",
    eventName: "order.return.updated",
    icon: "refund",
    previewAction: "عرض تفاصيل الاسترجاع",
    variables: ["customer_name", "order_number", "return_number", "refund_amount", "currency", "refund_method", "refund_type", "completed_at", "store_name"],
    body: "مرحبًا {{customer_name}}،\n\nنؤكد استلام المرتجع الخاص بطلبك رقم {{order_number}}.\nتم استكمال طلب الاسترجاع بنجاح، وسيتم تحديث حالة المبلغ المرجع حسب وسيلة الدفع.\n\n{{refund_summary}}",
    emailSubject: "تم استلام المرتجع"
  },
  {
    key: SALLA_TEMPLATE_KEYS.SHIPPED,
    name: "تم الشحن",
    description: "إرسال رقم التتبع ورابط الشحنة عند توفرهما من سلة.",
    triggerType: "order_status",
    icon: "plane",
    previewAction: "تتبع الشحنة",
    suggestedSlugs: ["shipped"],
    variables: ["customer_name", "order_number", "shipping_company", "tracking_number", "tracking_url", "store_name"],
    body: "مرحبًا {{customer_name}}،\n\nتم شحن طلبك رقم {{order_number}} بنجاح 🚚\nرقم التتبع: {{tracking_number}}\nشركة الشحن: {{shipping_company}}\n\nيمكنك متابعة الشحنة من الرابط التالي:\n{{tracking_url}}",
    emailSubject: "تم شحن طلبك"
  }
];

export const SALLA_TEMPLATE_DEFINITIONS = Object.freeze(definitions.map((item) => Object.freeze(item)));
const legacyInvoiceDefinition = Object.freeze({
  key: "salla_invoice_ready",
  name: "إرسال الفاتورة",
  description: "إرسال رابط صفحة فاتورة آمنة تستمد أرقامها من فاتورة سلة.",
  triggerType: "invoice_event",
  eventName: "invoice.created",
  icon: "invoice",
  previewAction: "عرض الفاتورة",
  variables: ["customer_name", "order_number", "invoice_number", "invoice_date", "amount", "currency", "invoice_url", "store_name"],
  body: "مرحبًا {{customer_name}}،\n\nفاتورتك رقم {{invoice_number}} جاهزة.\nيمكنك عرض الفاتورة وتفاصيل الدفع من الرابط الآمن:\n{{invoice_url}}",
  emailSubject: "فاتورتك رقم {{invoice_number}} جاهزة",
  settings: { invoiceTrigger: "invoice.created" }
});
const definitionMap = new Map([...definitions, legacyInvoiceDefinition].map((item) => [item.key, item]));

const legacyTemplateKeys = Object.freeze({
  [SALLA_TEMPLATE_KEYS.ABANDONED_CART]: "salla_abandoned_cart",
  [SALLA_TEMPLATE_KEYS.UNDER_REVIEW]: "salla_order_under_review",
  [SALLA_TEMPLATE_KEYS.PROCESSING]: "salla_order_processing",
  [SALLA_TEMPLATE_KEYS.COMPLETED]: "salla_order_completed",
  [SALLA_TEMPLATE_KEYS.SHIPPED]: "salla_order_shipped",
  [SALLA_TEMPLATE_KEYS.OUT_FOR_DELIVERY]: "salla_order_out_for_delivery",
  [SALLA_TEMPLATE_KEYS.DELIVERED]: "salla_order_delivered",
  [SALLA_TEMPLATE_KEYS.RETURN_IN_PROGRESS]: "salla_order_return_pending",
  [SALLA_TEMPLATE_KEYS.RETURNED]: "salla_order_returned"
});

function apiError(message, code = "SALLA_TEMPLATE_ERROR", status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function cleanSettings(input, current = {}) {
  const settings = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const cleanLabel = (value, fallback, max = 80) => String(value ?? fallback ?? "").trim().slice(0, max);
  const cleanContent = (value, fallback, max = 5000) => String(value ?? fallback ?? "").trim().slice(0, max);
  const delays = Array.isArray(settings.delaysMinutes)
    ? settings.delaysMinutes.slice(0, 3).map((item) => Math.max(5, Math.min(43200, Number(item) || 30)))
    : current.delaysMinutes;
  return {
    ...current,
    ...settings,
    ...(delays ? { delaysMinutes: delays } : {}),
    completedDeliveryMode: ["whatsapp_message", "secure_order_page"].includes(settings.completedDeliveryMode)
      ? settings.completedDeliveryMode : current.completedDeliveryMode,
    reviewDelayMinutes: Math.max(5, Math.min(43200, Number(settings.reviewDelayMinutes ?? current.reviewDelayMinutes) || 1440)),
    themeColor: /^#[0-9A-F]{6}$/i.test(settings.themeColor || "") ? settings.themeColor : (current.themeColor || "#2563EB"),
    buttonEnabled: settings.buttonEnabled == null ? current.buttonEnabled !== false : Boolean(settings.buttonEnabled),
    buttonLabel: cleanLabel(settings.buttonLabel, current.buttonLabel, 80),
    secureLinkEnabled: settings.secureLinkEnabled == null ? current.secureLinkEnabled !== false : Boolean(settings.secureLinkEnabled),
    linkPageTitle: cleanLabel(settings.linkPageTitle, current.linkPageTitle, 160),
    linkPageContent: cleanContent(settings.linkPageContent, current.linkPageContent, 5000),
    showCountdown: settings.showCountdown == null ? current.showCountdown !== false : Boolean(settings.showCountdown),
    showDuration: settings.showDuration == null ? current.showDuration === true : Boolean(settings.showDuration),
    linkExpiresInDays: Math.max(1, Math.min(3650, Number(settings.linkExpiresInDays ?? current.linkExpiresInDays) || 365)),
    branding: {
      ...(current.branding && typeof current.branding === "object" ? current.branding : {}),
      ...(settings.branding && typeof settings.branding === "object" ? settings.branding : {}),
      themeColor: /^#[0-9A-F]{6}$/i.test(settings.branding?.themeColor || "")
        ? settings.branding.themeColor
        : (/^#[0-9A-F]{6}$/i.test(current.branding?.themeColor || "") ? current.branding.themeColor : "#2563EB"),
      logoUrl: safePublicHttpsUrl(settings.branding?.logoUrl || current.branding?.logoUrl || "")
    }
  };
}

function rowPayload(row) {
  const definition = definitionMap.get(row.templateKey);
  const whatsappContent = row.whatsappContent || row.messageBody || definition?.body || "";
  const emailTextContent = row.emailTextContent || row.messageBody || definition?.body || "";
  const settings = row.settings || {};
  return {
    ...row,
    name: definition?.name || row.templateKey,
    description: definition?.description || "",
    icon: definition?.icon || "template",
    variables: definition?.variables || [],
    previewAction: settings.buttonLabel || definition?.previewAction || "عرض التفاصيل",
    buttonEnabled: settings.buttonEnabled !== false,
    whatsappContent,
    emailTextContent,
    emailHtmlContent: row.emailHtmlContent || emailTextContent,
    messageBody: row.channel === "email" ? emailTextContent : whatsappContent,
    settings,
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
    const defaultKeys = definitions.flatMap((definition) => [
      `platform_salla_default_${definition.key}_whatsapp`,
      `platform_salla_default_${definition.key}_email`
    ]);
    const platformDefaults = await client.query(
      `SELECT template_key AS "templateKey",subject,body,settings
         FROM admin_message_templates
        WHERE template_key=ANY($1::text[])`,
      [defaultKeys]
    );
    const defaultsByKey = new Map(platformDefaults.rows.map((row) => [row.templateKey, row]));
    for (const definition of [...definitions, legacyInvoiceDefinition]) {
      const legacyKey = legacyTemplateKeys[definition.key] || null;
      const whatsappDefault = defaultsByKey.get(`platform_salla_default_${definition.key}_whatsapp`);
      const emailDefault = defaultsByKey.get(`platform_salla_default_${definition.key}_email`);
      await client.query(
        `INSERT INTO tenant_salla_templates (
           tenant_id,salla_integration_id,template_key,is_enabled,trigger_type,salla_event_name,
           mapped_status_id,mapped_status_slug,mapped_status_name,delivery_channel,whatsapp_template_id,
           email_subject,message_body,whatsapp_content,email_text_content,email_html_content,settings,
           review_delay_minutes
         )
         SELECT $1,$2,$3,COALESCE(legacy.is_enabled,false),$4,$5,
                legacy.mapped_status_id,legacy.mapped_status_slug,legacy.mapped_status_name,
                legacy.delivery_channel,legacy.whatsapp_template_id,
                COALESCE(legacy.email_subject,$7),COALESCE(legacy.message_body,$6),
                COALESCE(legacy.whatsapp_content,legacy.message_body,$6),
                COALESCE(legacy.email_text_content,legacy.message_body,$10),
                COALESCE(legacy.email_html_content,legacy.message_body,$10),
                COALESCE(legacy.settings,$8::jsonb),
                COALESCE(legacy.review_delay_minutes,($8::jsonb->>'reviewDelayMinutes')::integer,1440)
           FROM (SELECT 1) seed
           LEFT JOIN tenant_salla_templates legacy
             ON legacy.tenant_id=$1 AND legacy.template_key=$9
         ON CONFLICT (tenant_id,template_key) DO UPDATE SET
           salla_integration_id=EXCLUDED.salla_integration_id,
           trigger_type=EXCLUDED.trigger_type,
           salla_event_name=COALESCE(tenant_salla_templates.salla_event_name,EXCLUDED.salla_event_name),
           whatsapp_content=COALESCE(tenant_salla_templates.whatsapp_content,EXCLUDED.whatsapp_content),
           email_text_content=COALESCE(tenant_salla_templates.email_text_content,EXCLUDED.email_text_content),
           email_html_content=COALESCE(tenant_salla_templates.email_html_content,EXCLUDED.email_html_content),
           updated_at=tenant_salla_templates.updated_at`,
        [tenantId, id, definition.key, definition.triggerType, definition.eventName || null,
          whatsappDefault?.body || definition.body,
          emailDefault?.subject || definition.emailSubject || null,
          JSON.stringify({ ...(definition.settings || {}), ...(whatsappDefault?.settings || {}), ...(emailDefault?.settings || {}) }), legacyKey,
          emailDefault?.body || definition.body]
      );
    }
    const store = await client.query(
      `SELECT provider_store_id AS "storeId" FROM app_connections
        WHERE id=$1 AND tenant_id=$2 AND provider='salla' LIMIT 1`,
      [id, tenantId]
    );
    if (store.rows[0]?.storeId) {
      await client.query(
        `INSERT INTO salla_delivery_source_configs (
           tenant_id,salla_integration_id,store_id,source_type,source_field_key,enabled
         ) VALUES ($1,$2,$3,'item_custom_field','renvix_delivery_content',true)
         ON CONFLICT (tenant_id,store_id) DO NOTHING`,
        [tenantId, id, String(store.rows[0].storeId)]
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
            email_subject AS "emailSubject",message_body AS "messageBody",
            whatsapp_content AS "whatsappContent",email_text_content AS "emailTextContent",
            email_html_content AS "emailHtmlContent",email_image_url AS "emailImageUrl",
            email_image_alt AS "emailImageAlt",review_delay_minutes AS "reviewDelayMinutes",settings,version,
            last_sent_at AS "lastSentAt",last_failure_at AS "lastFailureAt",
            last_failure_code AS "lastFailureCode",updated_at AS "updatedAt"
       FROM tenant_salla_templates WHERE tenant_id=$1 AND template_key=ANY($2::text[])`,
    [tenantId, definitions.map((item) => item.key)]
  );
  const rowsByKey = new Map(result.rows.map((row) => [row.templateKey, row]));
  return {
    available: true,
    roleAllowed: true,
    integration: {
      id: access.connection.id,
      status: access.connection.status,
      readinessStatus: access.connection.readiness_status,
      storeName: access.connection.provider_store_name
    },
    items: definitions.map((definition) => rowsByKey.get(definition.key)).filter(Boolean).map(rowPayload)
  };
}

export async function getSallaAutomationTemplate({ tenantId, userId, templateKey }) {
  if (!definitionMap.has(templateKey)) throw apiError("قالب سلة غير معروف.", "TEMPLATE_NOT_FOUND", 404);
  const payload = await listSallaAutomationTemplates({ tenantId, userId });
  if (!payload.available) return payload;
  let item = payload.items.find((template) => template.templateKey === templateKey);
  if (!item && templateKey === legacyInvoiceDefinition.key) {
    const invoice = await query(
      `SELECT id,template_key AS "templateKey",is_enabled AS "isEnabled",trigger_type AS "triggerType",
              salla_event_name AS "eventName",mapped_status_id AS "mappedStatusId",
              mapped_status_slug AS "mappedStatusSlug",mapped_status_name AS "mappedStatusName",
              delivery_channel AS channel,whatsapp_template_id AS "whatsappTemplateId",
              email_subject AS "emailSubject",message_body AS "messageBody",
              whatsapp_content AS "whatsappContent",email_text_content AS "emailTextContent",
              email_html_content AS "emailHtmlContent",email_image_url AS "emailImageUrl",
              email_image_alt AS "emailImageAlt",review_delay_minutes AS "reviewDelayMinutes",settings,version,
              last_failure_at AS "lastFailureAt",last_failure_code AS "lastFailureCode",updated_at AS "updatedAt"
         FROM tenant_salla_templates WHERE tenant_id=$1 AND template_key=$2 LIMIT 1`,
      [tenantId, templateKey]
    );
    item = invoice.rows[0] ? rowPayload(invoice.rows[0]) : null;
  }
  const [statuses, metaTemplates, storeProfile] = await Promise.all([
    query(`SELECT external_status_id AS id,status_slug AS slug,status_name AS name,is_custom AS "isCustom"
             FROM salla_order_statuses WHERE tenant_id=$1 AND is_active=true ORDER BY status_name`, [tenantId]),
    query(`SELECT id,template_name AS name,display_name AS "displayName",language,local_status AS status
             FROM meta_message_templates
            WHERE tenant_id=$1 AND local_status='approved' AND deleted_at IS NULL ORDER BY updated_at DESC`, [tenantId]),
    query(`SELECT store_name AS "storeName",logo_url AS "logoUrl",
                  logo_border_radius AS "logoBorderRadius"
             FROM order_link_profiles WHERE tenant_id=$1 LIMIT 1`, [tenantId])
  ]);
  return {
    ...payload,
    item,
    statuses: statuses.rows,
    metaTemplates: metaTemplates.rows,
    storeProfile: storeProfile.rows[0] || { storeName: payload.integration?.storeName || "", logoUrl: null, logoBorderRadius: 16 }
  };
}

export async function saveSallaAutomationTemplate({ tenantId, userId, templateKey, input }) {
  const definition = definitionMap.get(templateKey);
  if (!definition) throw apiError("قالب سلة غير معروف.", "TEMPLATE_NOT_FOUND", 404);
  const channel = input.channel == null || input.channel === "" ? null : String(input.channel);
  if (channel && !["whatsapp", "email"].includes(channel)) throw apiError("قناة الإرسال غير صالحة.", "INVALID_CHANNEL");
  const access = await transaction((client) => sallaAccess(client, tenantId, userId, { lock: true }));
  if (!access.available) throw apiError("اربط متجر سلة أولًا.", "SALLA_NOT_CONNECTED", 409);
  if (!access.roleAllowed) throw apiError("لا تملك صلاحية إدارة قوالب سلة.", "FORBIDDEN", 403);
  await ensureSallaAutomationTemplates(tenantId, access.connection.id);
  const current = await query(
    `SELECT settings,message_body AS "messageBody",whatsapp_content AS "whatsappContent",
            email_text_content AS "emailTextContent",email_html_content AS "emailHtmlContent"
       FROM tenant_salla_templates WHERE tenant_id=$1 AND template_key=$2`,
    [tenantId, templateKey]
  );
  const previous = current.rows[0] || {};
  const { whatsappContent, emailTextContent, emailHtmlContent } = resolveSallaChannelContent({
    input,
    previous,
    definition,
    channel
  });
  const body = channel === "email" ? emailTextContent : whatsappContent;
  if (!body) throw apiError("محتوى قناة الإرسال المحددة مطلوب.", "MESSAGE_REQUIRED");
  const settings = cleanSettings(input.settings, current.rows[0]?.settings || definition.settings || {});
  const result = await query(
    `UPDATE tenant_salla_templates SET
       delivery_channel=$3,whatsapp_template_id=$4,email_subject=$5,message_body=$6,
       mapped_status_id=$7,mapped_status_slug=$8,mapped_status_name=$9,settings=$10::jsonb,
       whatsapp_content=$11,email_text_content=$12,email_html_content=$13,
       review_delay_minutes=$14,
       version=version+1,updated_at=now()
     WHERE tenant_id=$1 AND template_key=$2
     RETURNING id,template_key AS "templateKey",is_enabled AS "isEnabled",trigger_type AS "triggerType",
       salla_event_name AS "eventName",mapped_status_id AS "mappedStatusId",
       mapped_status_slug AS "mappedStatusSlug",mapped_status_name AS "mappedStatusName",
       delivery_channel AS channel,whatsapp_template_id AS "whatsappTemplateId",
       email_subject AS "emailSubject",message_body AS "messageBody",
       whatsapp_content AS "whatsappContent",email_text_content AS "emailTextContent",
       email_html_content AS "emailHtmlContent",email_image_url AS "emailImageUrl",
       email_image_alt AS "emailImageAlt",review_delay_minutes AS "reviewDelayMinutes",
       settings,version,updated_at AS "updatedAt"`,
    [tenantId, templateKey, channel, input.whatsappTemplateId || null,
      String(input.emailSubject || "").trim().slice(0, 300) || null, body,
      input.mappedStatusId || null, input.mappedStatusSlug || null, input.mappedStatusName || null,
      JSON.stringify(settings), whatsappContent, emailTextContent, emailHtmlContent, settings.reviewDelayMinutes || 1440]
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
  const access = await transaction((client) => sallaAccess(client, tenantId, userId));
  if (!access.available) throw apiError("تكامل سلة غير متصل.", "SALLA_NOT_CONNECTED", 409);
  if (!access.roleAllowed) throw apiError("لا تملك الصلاحية.", "FORBIDDEN", 403);
  if (enabled) {
    await query(
      `UPDATE tenant_salla_templates SET delivery_channel=COALESCE(delivery_channel,'whatsapp'),updated_at=now()
        WHERE tenant_id=$1 AND template_key=$2`,
      [tenantId, templateKey]
    );
    const validation = await validateSallaAutomationTemplate({ tenantId, userId, templateKey });
    if (!validation.ok) return validation;
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
    digital_content_url: "https://renvix.app/o/preview?t=preview",
    product_name: "المنتج الرقمي",
    activation_code: "RVX-2026-DEMO",
    delivery_date: "02/08/2026",
    rating_url: "https://store.example/rating/preview",
    cancellation_reason: "تم الإلغاء بناءً على طلب العميل",
    optional_action: "يسعدنا تقييم تجربتك.",
    ...variables
  };
  return {
    channel: item.channel,
    subject: item.emailSubject ? renderSallaTemplate(item.emailSubject, demo) : null,
    body: renderSallaTemplate(
      item.channel === "email"
        ? (item.emailTextContent || item.messageBody)
        : (item.whatsappContent || item.messageBody),
      demo
    ),
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
    previousStatusId: String(data?.previous_status?.id || data?.old_status?.id || data?.previous_status_id || "").trim() || null,
    previousStatusSlug: String(data?.previous_status?.slug || data?.old_status?.slug || data?.previous_status_slug || "").trim() || null,
    occurredAt: new Date(payload?.created_at || data?.created_at || Date.now())
  };
}

export function resolveSallaChannelContent({ input = {}, previous = {}, definition = {}, channel = null }) {
  const whatsappContent = String(
    input.whatsappContent ?? (channel === "whatsapp" ? input.messageBody : previous.whatsappContent) ?? definition.body ?? ""
  ).trim().slice(0, 10000);
  const emailTextContent = String(
    input.emailTextContent ?? (channel === "email" ? input.messageBody : previous.emailTextContent) ?? definition.body ?? ""
  ).trim().slice(0, 10000);
  const emailHtmlContent = String(input.emailHtmlContent ?? previous.emailHtmlContent ?? emailTextContent).trim().slice(0, 30000);
  return { whatsappContent, emailTextContent, emailHtmlContent };
}

export function safePublicHttpsUrl(value) {
  try {
    const parsed = new URL(String(value || ""));
    const host = parsed.hostname.toLowerCase();
    if (parsed.protocol !== "https:" || host === "localhost" || host === "127.0.0.1" || host === "::1"
      || host.endsWith(".local") || /^10\./.test(host) || /^192\.168\./.test(host)
      || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

export function paidDigitalDelivery(data = {}) {
  const status = String(data.payment?.status || data.payment_status || data.status?.slug || data.status || "").toLowerCase();
  const paid = data.payment?.paid === true || data.paid === true || ["paid", "success", "succeeded", "completed"].includes(status);
  const raw = data.urls?.digital_content || data.order?.urls?.digital_content || [];
  const entries = Array.isArray(raw) ? raw : [raw];
  const assets = entries.map((item, index) => {
    const value = typeof item === "string" ? { url: item } : (item || {});
    const url = safePublicHttpsUrl(value.url || value.link);
    if (!url) return null;
    return {
      name: String(value.name || value.product_name || data.items?.[index]?.name || data.order?.items?.[index]?.name || `المنتج الرقمي ${index + 1}`).slice(0, 240),
      url,
      code: String(value.code || value.activation_code || "").slice(0, 500),
      email: String(value.email || value.username || "").slice(0, 320),
      password: String(value.password || value.passcode || "").slice(0, 500),
      expiresAt: value.expires_at || value.expiresAt || null,
      durationSeconds: Math.max(0, Math.min(31_536_000, Number(value.duration_seconds || value.durationSeconds || 0)))
    };
  }).filter(Boolean);
  return { paid, links: assets.map((item) => item.url), assets };
}

function statusMatches(statusId, statusSlug, mappedId, mappedSlug) {
  return (mappedId && String(statusId || "") === String(mappedId))
    || (mappedSlug && String(statusSlug || "").toLowerCase() === String(mappedSlug).toLowerCase());
}

async function claimCompletedTransition({ tenantId, storeId, orderId, currentStatusId, currentStatusSlug,
  previousStatusId, previousStatusSlug, mappedStatusId, mappedStatusSlug, occurredAt, externalEventId }) {
  return transaction(async (client) => {
    const existing = await client.query(
      `SELECT current_status_id AS "statusId",current_status_slug AS "statusSlug",latest_event_at AS "latestEventAt"
         FROM salla_order_transition_state
        WHERE tenant_id=$1 AND store_id=$2 AND external_order_id=$3 FOR UPDATE`,
      [tenantId, storeId, orderId]
    );
    const state = existing.rows[0];
    if (state?.latestEventAt && new Date(state.latestEventAt) > occurredAt) return { claimed: false, reason: "stale_event" };
    const previousId = state?.statusId || previousStatusId || null;
    const previousSlug = state?.statusSlug || previousStatusSlug || null;
    const isCompleted = statusMatches(currentStatusId, currentStatusSlug, mappedStatusId, mappedStatusSlug);
    const wasCompleted = statusMatches(previousId, previousSlug, mappedStatusId, mappedStatusSlug);
    const transitioned = isCompleted && !wasCompleted && Boolean(previousId || previousSlug);
    await client.query(
      `INSERT INTO salla_order_transition_state (
         tenant_id,store_id,external_order_id,current_status_id,current_status_slug,completed_at,latest_event_at,latest_event_id
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (tenant_id,store_id,external_order_id) DO UPDATE SET
         current_status_id=EXCLUDED.current_status_id,current_status_slug=EXCLUDED.current_status_slug,
         completed_at=COALESCE(salla_order_transition_state.completed_at,EXCLUDED.completed_at),
         latest_event_at=EXCLUDED.latest_event_at,latest_event_id=EXCLUDED.latest_event_id,updated_at=now()`,
      [tenantId, storeId, orderId, currentStatusId, currentStatusSlug, transitioned ? occurredAt : null, occurredAt, externalEventId]
    );
    return { claimed: transitioned, reason: transitioned ? null : (isCompleted ? "not_a_new_transition" : "not_completed"), completedAt: transitioned ? occurredAt : null };
  });
}

async function fetchSallaOrderDetails(connection, orderId, fallback) {
  if (!orderId) return fallback;
  try {
    const token = await getSallaAccessToken(connection);
    const base = (process.env.SALLA_API_BASE_URL || "https://api.salla.dev/admin/v2").replace(/\/$/, "");
    const headers = { authorization: `Bearer ${token}`, accept: "application/json" };
    const response = await fetch(`${base}/orders/${encodeURIComponent(orderId)}`, { headers });
    const result = await response.json().catch(() => ({}));
    const detail = response.ok && result?.data ? result.data : fallback;
    if (Array.isArray(detail?.items) && detail.items.length) return detail;
    const itemsResponse = await fetch(`${base}/orders/${encodeURIComponent(orderId)}/items`, { headers });
    const itemsResult = await itemsResponse.json().catch(() => ({}));
    const items = Array.isArray(itemsResult?.data)
      ? itemsResult.data
      : Array.isArray(itemsResult?.data?.items) ? itemsResult.data.items : [];
    return itemsResponse.ok && items.length ? { ...detail, items } : detail;
  } catch {
    return fallback;
  }
}

async function recordObservedOrderStatus({ tenantId, storeId, orderId, statusId, statusSlug, occurredAt, externalEventId }) {
  if (!orderId || (!statusId && !statusSlug)) return;
  await query(
    `INSERT INTO salla_order_transition_state (
       tenant_id,store_id,external_order_id,current_status_id,current_status_slug,latest_event_at,latest_event_id
     ) VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (tenant_id,store_id,external_order_id) DO UPDATE SET
       current_status_id=EXCLUDED.current_status_id,current_status_slug=EXCLUDED.current_status_slug,
       latest_event_at=EXCLUDED.latest_event_at,latest_event_id=EXCLUDED.latest_event_id,updated_at=now()
     WHERE salla_order_transition_state.latest_event_at<=EXCLUDED.latest_event_at`,
    [tenantId, storeId, orderId, statusId, statusSlug, occurredAt, externalEventId]
  );
}

async function buildSmartDigitalAssets({ order, sourceConfig, showDuration, completedAt }) {
  const sources = extractTrustedDeliveryContent(order, sourceConfig);
  const assets = [];
  for (const source of sources) {
    const parsed = await classifyAmbiguousDeliveryContent(
      parseSmartDeliveryContent(source.content, { productName: source.productName })
    );
    const item = (order.items || []).find((entry, index) => String(entry.id || entry.product_id || index + 1) === source.orderItemId) || {};
    const duration = showDuration ? await resolveProductDurationWithDeepSeek({
      deliveryContent: source.content,
      itemOptions: Array.isArray(item.options) ? item.options : [],
      itemTitleSnapshot: source.productName,
      currentProductTitle: item.product?.name,
      productDescription: item.product?.description
    }) : { visible: false, source: "unknown", durationDays: null, lifetime: false };
    const window = durationWindow(duration, completedAt);
    assets.push({
      orderItemId: source.orderItemId,
      productId: String(item.product_id || item.product?.id || ""),
      sku: String(item.sku || item.product?.sku || ""),
      name: parsed.title,
      fields: parsed.fields.map((entry) => {
        const clean = { ...entry };
        delete clean.sourceLine;
        return clean;
      }),
      instructions: parsed.instructions,
      classificationSource: parsed.classificationSource || "local",
      sourceContentHash: deliveryContentHash(source.content),
      parserVersion: parsed.parserVersion || "local-v1",
      modelVersion: parsed.classificationSource === "deepseek" ? "deepseek-v4-flash" : null,
      showDuration: duration.visible === true,
      durationDays: duration.visible ? duration.durationDays : null,
      durationSource: duration.source,
      durationConfidence: duration.classificationSource === "deepseek" ? 0.8 : (duration.visible ? 1 : null),
      lifetime: duration.visible && duration.lifetime,
      startsAt: duration.visible ? window.startsAt.toISOString() : null,
      expiresAt: window.expiresAt?.toISOString() || null
    });
  }
  return assets;
}

async function claimSallaEventWatermark({ tenantId, templateKey, externalEntityId, occurredAt, externalEventId }) {
  if (!externalEntityId || !(occurredAt instanceof Date) || Number.isNaN(occurredAt.getTime())) return true;
  const result = await query(
    `INSERT INTO salla_template_entity_state (
       tenant_id,template_key,external_entity_id,latest_event_at,latest_event_id
     ) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (tenant_id,template_key,external_entity_id) DO UPDATE SET
       latest_event_at=EXCLUDED.latest_event_at,latest_event_id=EXCLUDED.latest_event_id,updated_at=now()
     WHERE salla_template_entity_state.latest_event_at<=EXCLUDED.latest_event_at
     RETURNING latest_event_at`,
    [tenantId, templateKey, externalEntityId, occurredAt, externalEventId]
  );
  return Boolean(result.rows[0]);
}

export async function processSallaTemplateEvent(payload) {
  const normalized = normalizeSallaTemplateEvent(payload);
  if (!normalized.storeId) return { status: "ignored", reason: "store_missing" };
  const connection = await query(
    `SELECT id,tenant_id,provider_store_id,access_token_encrypted,refresh_token_encrypted,token_expires_at FROM app_connections
      WHERE provider='salla' AND provider_store_id=$1 AND status IN ('connected','ready') LIMIT 1`,
    [normalized.storeId]
  );
  if (!connection.rows[0]) return { status: "ignored", reason: "connection_missing" };
  const tenantId = connection.rows[0].tenant_id;
  await ensureSallaAutomationTemplates(tenantId, connection.rows[0].id);
  if (normalized.orderId && (normalized.statusId || normalized.statusSlug)) {
    const digitalMapping = await query(
      `SELECT mapped_status_id AS "statusId",mapped_status_slug AS "statusSlug"
         FROM tenant_salla_templates
        WHERE tenant_id=$1 AND template_key=$2 LIMIT 1`,
      [tenantId, SALLA_TEMPLATE_KEYS.DIGITAL_PRODUCT_DELIVERY]
    );
    const mapping = digitalMapping.rows[0];
    if (mapping && !statusMatches(normalized.statusId, normalized.statusSlug, mapping.statusId, mapping.statusSlug)) {
      await recordObservedOrderStatus({
        tenantId,
        storeId: normalized.storeId,
        orderId: normalized.orderId,
        statusId: normalized.statusId,
        statusSlug: normalized.statusSlug,
        occurredAt: normalized.occurredAt,
        externalEventId: normalized.externalEventId
      });
    }
  }
  if (normalized.orderId && ["order.cancelled", "order.refunded", "order.return.created", "order.return.updated"].includes(normalized.eventName)) {
    await transaction(async (client) => {
      await client.query(
        `UPDATE message_queue queue SET status='cancelled',last_error='review_request_no_longer_valid',updated_at=now()
          FROM salla_template_deliveries delivery
         WHERE delivery.message_queue_id=queue.id AND delivery.tenant_id=$1
           AND delivery.external_order_id=$2 AND delivery.template_key=$3 AND queue.status='pending'`,
        [tenantId, normalized.orderId, SALLA_TEMPLATE_KEYS.REVIEW_REQUEST]
      );
      await client.query(
        `UPDATE salla_template_deliveries SET status='skipped',failure_code='review_request_cancelled',updated_at=now()
          WHERE tenant_id=$1 AND external_order_id=$2 AND template_key=$3 AND status='queued'`,
        [tenantId, normalized.orderId, SALLA_TEMPLATE_KEYS.REVIEW_REQUEST]
      );
      await client.query(
        `UPDATE salla_digital_entitlements SET status='revoked',duration_status='revoked',revoked_at=now(),revoke_reason=$3,updated_at=now()
          WHERE tenant_id=$1 AND external_order_id=$2 AND status='active'`,
        [tenantId, normalized.orderId, normalized.eventName]
      );
      await client.query(
        `UPDATE message_queue queue SET status='cancelled',last_error='digital_delivery_revoked',updated_at=now()
          FROM salla_template_deliveries delivery
         WHERE delivery.message_queue_id=queue.id AND delivery.tenant_id=$1
           AND delivery.external_order_id=$2 AND delivery.template_key=$3 AND queue.status='pending'`,
        [tenantId, normalized.orderId, SALLA_TEMPLATE_KEYS.DIGITAL_PRODUCT_DELIVERY]
      );
      await client.query(
        `UPDATE salla_template_deliveries SET status='skipped',failure_code='digital_delivery_revoked',updated_at=now()
          WHERE tenant_id=$1 AND external_order_id=$2 AND template_key=$3 AND status='queued'`,
        [tenantId, normalized.orderId, SALLA_TEMPLATE_KEYS.DIGITAL_PRODUCT_DELIVERY]
      );
    });
    await revokeSallaPublicPages({ tenantId, storeId: normalized.storeId, externalEntityId: normalized.orderId, reason: normalized.eventName });
  }
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
        OR (trigger_type='event' AND salla_event_name=$2)
        OR (template_key='cancelled' AND $2='order.deleted')
        OR (template_key='returned' AND $2='order.refunded')
        OR (trigger_type='order_status' AND (
          mapped_status_id=$3 OR (mapped_status_slug IS NOT NULL AND mapped_status_slug=$4)
        ))
      )`,
    [tenantId, normalized.eventName, normalized.statusId, normalized.statusSlug]
  );
  if (!candidates.rows.length) return { status: "skipped", reason: "template_disabled_or_unmapped" };
  const brandProfileResult = await query(
    `SELECT store_name AS "storeName",logo_url AS "logoUrl",logo_border_radius AS "logoBorderRadius"
       FROM order_link_profiles WHERE tenant_id=$1 LIMIT 1`,
    [tenantId]
  );
  const brandProfile = brandProfileResult.rows[0] || {};
  const webhookData = payload?.data || {};
  let queued = 0;
  for (const template of candidates.rows) {
    if (!template.delivery_channel) continue;
    let digitalDelivery = null;
    if (template.template_key === SALLA_TEMPLATE_KEYS.DIGITAL_PRODUCT_DELIVERY) {
      const transition = await claimCompletedTransition({
        tenantId,
        storeId: normalized.storeId,
        orderId: normalized.orderId,
        currentStatusId: normalized.statusId,
        currentStatusSlug: normalized.statusSlug,
        previousStatusId: normalized.previousStatusId,
        previousStatusSlug: normalized.previousStatusSlug,
        mappedStatusId: template.mapped_status_id,
        mappedStatusSlug: template.mapped_status_slug,
        occurredAt: normalized.occurredAt,
        externalEventId: normalized.externalEventId
      });
      if (!transition.claimed) continue;
      const order = await fetchSallaOrderDetails(connection.rows[0], normalized.orderId, webhookData);
      const sourceConfigResult = await query(
        `SELECT source_type AS "sourceType",source_field_key AS "sourceFieldKey",enabled
           FROM salla_delivery_source_configs
          WHERE tenant_id=$1 AND store_id=$2 LIMIT 1`,
        [tenantId, normalized.storeId]
      );
      const assets = await buildSmartDigitalAssets({
        order,
        sourceConfig: sourceConfigResult.rows[0],
        showDuration: template.settings?.showDuration === true,
        completedAt: transition.completedAt
      });
      if (!assets.length) {
        await createInAppNotification({
          tenantId,
          type: "missing_delivery_content",
          title: "معلومات التسليم غير موجودة",
          message: `لم يُعثر على معلومات التسليم المعتمدة للطلب ${normalized.orderId}. لم تُرسل أي رسالة.`,
          priority: "high",
          actionUrl: "/dashboard/apps/salla/templates/digital_product_delivery",
          metadata: { orderId: normalized.orderId, storeId: normalized.storeId },
          dedupeKey: `missing-delivery:${tenantId}:${normalized.orderId}`
        }).catch(() => null);
        await query(
          `INSERT INTO activity_logs (tenant_id,type,title,metadata)
           VALUES ($1,'salla.delivery.missing','Salla delivery content missing',$2::jsonb)`,
          [tenantId, JSON.stringify({ orderId: normalized.orderId, storeId: normalized.storeId, code: "missing_delivery_content" })]
        );
        continue;
      }
      digitalDelivery = { assets, links: [] };
      for (const asset of assets) {
        await query(
          `INSERT INTO salla_digital_entitlements (
             tenant_id,store_id,external_order_id,external_order_item_id,product_id,sku,product_name,
             show_duration,duration_type,duration_days,lifetime,duration_source,duration_matched_text_hash,
             duration_confidence,duration_status,parser_version,model_version,starts_at,expires_at,period_history
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::jsonb)
           ON CONFLICT (tenant_id,store_id,external_order_id,external_order_item_id) DO NOTHING`,
          [tenantId, normalized.storeId, normalized.orderId, asset.orderItemId, asset.productId || null,
            asset.sku || null, asset.name, asset.showDuration, asset.lifetime ? "lifetime" : asset.durationDays ? "fixed" : "unknown",
            asset.durationDays, asset.lifetime, asset.durationSource, asset.sourceContentHash, asset.durationConfidence,
            asset.lifetime ? "lifetime" : asset.durationDays ? "active" : "unknown", asset.parserVersion,
            asset.modelVersion, asset.startsAt || transition.completedAt, asset.expiresAt,
            JSON.stringify([{ startsAt: asset.startsAt, expiresAt: asset.expiresAt, durationDays: asset.durationDays, source: asset.durationSource }])]
        );
      }
    }
    const data = template.template_key === SALLA_TEMPLATE_KEYS.DIGITAL_PRODUCT_DELIVERY
      ? await fetchSallaOrderDetails(connection.rows[0], normalized.orderId, webhookData)
      : webhookData;
    if (template.template_key === SALLA_TEMPLATE_KEYS.REVIEW_REQUEST
      && !safePublicHttpsUrl(data.urls?.rating || data.order?.urls?.rating || data.rating_url)) continue;
    if (template.template_key === SALLA_TEMPLATE_KEYS.RETURNED) {
      const returnStatus = String(data.return?.status?.slug || data.return?.status || data.status?.slug || data.status || "").toLowerCase();
      const completedReturn = normalized.eventName === "order.refunded" || data.refund?.confirmed === true
        || ["returned", "refunded", "completed", "succeeded"].includes(returnStatus);
      if (!completedReturn) continue;
    }
    const entityId = normalized.cartId || normalized.returnId || normalized.invoiceId || normalized.orderId;
    if (!await claimSallaEventWatermark({
      tenantId,
      templateKey: template.template_key,
      externalEntityId: entityId,
      occurredAt: normalized.occurredAt,
      externalEventId: normalized.externalEventId
    })) continue;
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
    const digitalItemKey = digitalDelivery?.assets?.map((item) => item.orderItemId).sort().join(",") || "order";
    const idempotencyKey = template.template_key === SALLA_TEMPLATE_KEYS.DIGITAL_PRODUCT_DELIVERY
      ? `salla:digital:${tenantId}:${normalized.storeId}:${normalized.orderId}:${digitalItemKey}:${normalized.occurredAt.toISOString()}:${template.delivery_channel}`
      : template.trigger_type === "abandoned_cart"
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
         external_invoice_id,external_return_id,channel,recipient_hash,idempotency_key,status,completed_transition_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'queued',$12)
       ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`,
      [tenantId, template.id, template.template_key, normalized.externalEventId,
        normalized.orderId, normalized.cartId, normalized.invoiceId, normalized.returnId,
        template.delivery_channel, recipientHash, idempotencyKey,
        template.template_key === SALLA_TEMPLATE_KEYS.DIGITAL_PRODUCT_DELIVERY ? normalized.occurredAt : null]
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
      digital_content_url: digitalDelivery?.links[0] || "",
      product_name: data.items?.[0]?.name || data.order?.items?.[0]?.name || data.product?.name || "",
      activation_code: "",
      delivery_date: data.delivery_date || data.shipment?.delivery_date || "",
      rating_url: safePublicHttpsUrl(data.urls?.rating || data.order?.urls?.rating || data.rating_url),
      cancellation_reason: data.reason || data.cancellation_reason || data.status?.note || "غير محدد",
      service_name: data.items?.[0]?.name || data.order?.items?.[0]?.name || "",
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
    const pageType = template.template_key === legacyInvoiceDefinition.key
      ? "invoice"
      : template.template_key === SALLA_TEMPLATE_KEYS.DIGITAL_PRODUCT_DELIVERY
        ? "digital"
      : template.template_key === SALLA_TEMPLATE_KEYS.COMPLETED
        ? "order"
        : null;
    let publicPage = null;
    if (pageType) {
      const externalEntityId = pageType === "invoice" ? normalized.invoiceId : normalized.orderId;
      const pageBranding = {
        ...(template.settings?.branding || {}),
        brandName: variables.store_name || brandProfile.storeName || "Renvix",
        logoUrl: template.settings?.branding?.logoUrl || brandProfile.logoUrl || "",
        logoBorderRadius: Number(template.settings?.branding?.logoBorderRadius ?? brandProfile.logoBorderRadius ?? 16),
        themeColor: template.settings?.themeColor || template.settings?.branding?.themeColor || "#2563EB"
      };
      publicPage = await getOrCreateSallaPublicPage({
        tenantId,
        storeId: normalized.storeId,
        templateId: template.id,
        pageType,
        externalEntityId,
        source: {
          ...data,
          order: data.order || (normalized.orderId ? { id: normalized.orderId } : {}),
          invoice: data.invoice || (normalized.invoiceId ? { id: normalized.invoiceId } : {}),
          branding: pageBranding,
          digitalDelivery: digitalDelivery?.assets || [],
          pageTitle: template.settings?.linkPageTitle || "منتجاتك الرقمية جاهزة",
          pageContent: template.settings?.linkPageContent || "استخدم البيانات التالية للوصول إلى منتجك الرقمي بأمان.",
          showDuration: template.settings?.showDuration === true,
          maxViews: template.settings?.maxViews || 100
        },
        branding: pageBranding,
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
      else if (pageType === "digital") variables.digital_content_url = publicPage.url;
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
      templateSnapshot: template.delivery_channel === "whatsapp" ? {
        provider: "meta",
        metaTemplateId: template.whatsapp_template_id,
        sallaTemplateKey: template.template_key
      } : {
        provider: "resend",
        sallaTemplateKey: template.template_key,
        branding: {
          brandName: variables.store_name || brandProfile.storeName || "Renvix",
          logoUrl: brandProfile.logoUrl || "",
          logoBorderRadius: Number(brandProfile.logoBorderRadius ?? 16)
        }
      },
      channelType: template.delivery_channel,
      messageType: "salla_template",
      destination: recipient,
      emailTo: template.delivery_channel === "email" ? recipient : null,
      subject: template.email_subject ? renderSallaTemplate(template.email_subject, variables) : null,
      messageBody: renderSallaTemplate(
        template.template_key === SALLA_TEMPLATE_KEYS.DIGITAL_PRODUCT_DELIVERY
          ? "مرحبًا {{customer_name}} 👋\n\nأصبحت معلومات تسليم طلبك رقم {{order_number}} جاهزة.\nلأمان بياناتك، اعرضها من الرابط الآمن التالي فقط:\n{{digital_content_url}}"
          : template.delivery_channel === "email"
            ? (template.email_text_content || template.message_body)
            : (template.whatsapp_content || template.message_body),
        variables
      ),
      referenceType: "salla_template_delivery",
      referenceId: inserted.rows[0].id,
      triggerKey: idempotencyKey,
      sourceMode: "automatic",
      enforceConnected: template.delivery_channel === "whatsapp"
    });
    if (queueResult.ok) {
      const firstAbandonedDelay = template.trigger_type === "abandoned_cart"
        ? Math.max(5, Number(template.settings?.delaysMinutes?.[0]) || 30)
        : template.template_key === SALLA_TEMPLATE_KEYS.REVIEW_REQUEST
          ? Math.max(5, Number(template.review_delay_minutes || template.settings?.reviewDelayMinutes) || 1440)
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
            templateSnapshot: template.delivery_channel === "whatsapp" ? {
              provider: "meta",
              metaTemplateId: template.whatsapp_template_id,
              sallaTemplateKey: template.template_key,
              abandonedCartMessageIndex: messageIndex
            } : {
              provider: "resend",
              sallaTemplateKey: template.template_key,
              abandonedCartMessageIndex: messageIndex,
              branding: {
                brandName: variables.store_name || brandProfile.storeName || "Renvix",
                logoUrl: brandProfile.logoUrl || "",
                logoBorderRadius: Number(brandProfile.logoBorderRadius ?? 16)
              }
            },
            channelType: template.delivery_channel,
            messageType: "salla_template",
            destination: recipient,
            emailTo: template.delivery_channel === "email" ? recipient : null,
            subject: template.email_subject ? renderSallaTemplate(template.email_subject, variables) : null,
            messageBody: renderSallaTemplate(
              template.delivery_channel === "email"
                ? (template.email_text_content || template.message_body)
                : (template.whatsapp_content || template.message_body),
              variables
            ),
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
