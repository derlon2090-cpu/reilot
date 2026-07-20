import { sendRenewalReminderEmail } from "../../../../src/server/email/resend.service.js";
import { query, transaction } from "../../../../src/server/db.js";
import { requireSession } from "../../../../src/server/session.js";
import { safeErrorMessage } from "../../../../src/server/security.js";
import {
  PLAN_MESSAGE_LIMIT_REACHED,
  consumeReservedQuotaWithClient,
  releaseReservedQuota,
  reserveMessageQuota
} from "../../../../src/lib/billing/message-quota.js";

const allowedChannels = new Set(["whatsapp", "email"]);
const whatsappVariables = ["customer_name", "plan_name", "expiry_date", "days_remaining", "renewal_url", "store_name", "order_number", "subscription_id", "service_name", "end_date", "renewal_link"];
const emailVariables = ["اسم_العميل", "اسم_الخدمة", "تاريخ_الانتهاء", "الأيام_المتبقية", "رابط_التجديد", "رقم_الطلب", "اسم_المتجر"];
const allTemplateVariables = [...new Set([...whatsappVariables, ...emailVariables])];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const colorPattern = /^#[0-9a-f]{6}$/i;

const defaultEmailTemplate = {
  name: "تذكير بتجديد الاشتراك",
  channel: "email",
  storeName: "",
  title: "تذكير بتجديد اشتراكك في {{اسم_الخدمة}}",
  themeColor: "#0EA5A8",
  body: "مرحبًا {{اسم_العميل}}،\n\nنود تذكيرك بأن اشتراكك في {{اسم_الخدمة}} سينتهي بتاريخ {{تاريخ_الانتهاء}}.\n\nلضمان استمرار الخدمة دون انقطاع، يرجى تجديد اشتراكك الآن.",
  buttonLabel: "جدد اشتراكك الآن",
  footerText: "شكرًا لثقتك بنا"
};

function sanitizePlainText(value, maxLength) {
  const text = String(value || "").replace(/\r\n?/g, "\n").trim();
  if (!text || text.length > maxLength) return null;
  if (/<\/?[a-z][^>]*>/i.test(text) || /javascript\s*:/i.test(text) || /<script|<iframe/i.test(text)) return null;
  const links = text.match(/https?:\/\/[^\s)]+/gi) || [];
  if (links.some((link) => !link.toLowerCase().startsWith("https://"))) return null;
  return text;
}

function hasOnlyAllowedVariables(text, allowed) {
  const found = [...String(text || "").matchAll(/{{\s*([^{}]+?)\s*}}/g)].map((match) => match[1]);
  return found.every((variable) => allowed.includes(variable));
}

function canonicalTemplateVariables(value) {
  return String(value || "")
    .replace(/{{\s*(?:اسم_العميل|name)\s*}}/g, "{{customer_name}}")
    .replace(/{{\s*(?:اسم_الخدمة|service_name)\s*}}/g, "{{plan_name}}")
    .replace(/{{\s*(?:تاريخ_الانتهاء|end_date)\s*}}/g, "{{expiry_date}}")
    .replace(/{{\s*الأيام_المتبقية\s*}}/g, "{{days_remaining}}")
    .replace(/{{\s*(?:رابط_التجديد|renewal_link)\s*}}/g, "{{renewal_url}}")
    .replace(/{{\s*رقم_الطلب\s*}}/g, "{{order_number}}")
    .replace(/{{\s*اسم_المتجر\s*}}/g, "{{store_name}}");
}

function structuredContent(text) {
  return {
    version: 1,
    blocks: String(text).split(/\n{2,}/).map((value) => ({ type: "paragraph", text: value.trim() })).filter((block) => block.text)
  };
}

function templateSelect() {
  return `SELECT id, name, channel, title, body, variables,
                 store_name AS "storeName", theme_color AS "themeColor",
                 content_json AS "contentJson", button_label AS "buttonLabel",
                 footer_text AS "footerText", template_version AS "templateVersion",
                 is_system_default AS "isSystemDefault", is_active AS "isActive",
                 updated_at AS "updatedAt"
            FROM notification_templates
           WHERE tenant_id = $1 AND trigger_type = 'before_expiry'
             AND channel IN ('whatsapp', 'email')
           ORDER BY channel, updated_at DESC`;
}

export async function GET(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const [templatesResult, rulesResult] = await Promise.all([
    query(templateSelect(), [auth.session.tenantId]),
    query(
      `SELECT ar.id, ar.template_id AS "templateId", lower(ar.channel) AS channel,
              ar.days_offset AS "daysOffset", ar.is_active AS "isActive"
         FROM automation_rules ar
         JOIN notification_templates nt ON nt.id = ar.template_id
        WHERE ar.tenant_id = $1 AND nt.trigger_type = 'before_expiry'
          AND lower(ar.channel) IN ('whatsapp', 'email')
        ORDER BY ar.channel, ar.updated_at DESC`,
      [auth.session.tenantId]
    )
  ]);
  const templates = templatesResult.rows.filter((item, index, rows) => rows.findIndex((row) => row.channel === item.channel) === index);
  const rules = rulesResult.rows.filter((item, index, rows) => rows.findIndex((row) => row.channel === item.channel) === index);
  const template = templates.find((item) => item.channel === "whatsapp") || templates[0] || null;
  const rule = rules.find((item) => item.templateId === template?.id) || null;
  return Response.json({ ok: true, templates, rules, template, rule, defaultEmailTemplate });
}

export async function PUT(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const input = await req.json().catch(() => ({}));
  const channel = allowedChannels.has(input.channel) ? input.channel : null;
  if (!channel) return Response.json({ ok: false, message: "قناة الإرسال غير متاحة حاليًا" }, { status: 400 });

  const name = sanitizePlainText(input.name, 120);
  const messageBody = sanitizePlainText(input.body, 8000);
  const daysOffset = Math.min(30, Math.max(0, Number(input.daysOffset || 7)));
  const isActive = input.isActive !== false;
  if (!name || !messageBody) return Response.json({ ok: false, message: "اسم القالب ومحتواه مطلوبان" }, { status: 400 });

  let title = null;
  let storeName = null;
  let themeColor = "#0EA5A8";
  let buttonLabel = null;
  let footerText = null;
  let variables = whatsappVariables;
  let contentJson = {};
  if (channel === "email") {
    title = sanitizePlainText(input.title, 180);
    storeName = sanitizePlainText(input.storeName, 100);
    buttonLabel = sanitizePlainText(input.buttonLabel, 80);
    footerText = sanitizePlainText(input.footerText, 300);
    themeColor = colorPattern.test(String(input.themeColor || "")) ? String(input.themeColor).toUpperCase() : "#0EA5A8";
    variables = emailVariables;
    contentJson = structuredContent(messageBody);
    if (!title || !storeName || !buttonLabel || !footerText) {
      return Response.json({ ok: false, message: "أكمل جميع حقول قالب البريد الإلكتروني" }, { status: 400 });
    }
    if (![title, messageBody, buttonLabel, footerText].every((value) => hasOnlyAllowedVariables(value, allTemplateVariables))) {
      return Response.json({ ok: false, message: "يحتوي القالب على متغير غير معتمد" }, { status: 400 });
    }
  } else if (!hasOnlyAllowedVariables(messageBody, whatsappVariables)) {
    return Response.json({ ok: false, message: "يحتوي قالب واتساب على متغير غير معتمد" }, { status: 400 });
  }

  const saved = await transaction(async (client) => {
    const existing = await client.query(
      `SELECT id, template_version FROM notification_templates
        WHERE tenant_id = $1 AND trigger_type = 'before_expiry' AND channel = $2
        ORDER BY updated_at DESC LIMIT 1`,
      [auth.session.tenantId, channel]
    );
    const template = existing.rows[0]
      ? await client.query(
          `UPDATE notification_templates
              SET name = $1, title = $2, body = $3, variables = $4::jsonb,
                  store_name = $5, theme_color = $6, content_json = $7::jsonb,
                  button_label = $8, footer_text = $9,
                  template_version = template_version + 1, updated_by = $10,
                  is_system_default = false, is_active = $11, updated_at = now()
            WHERE id = $12 AND tenant_id = $13
          RETURNING id, name, channel, title, body, variables, store_name AS "storeName",
                    theme_color AS "themeColor", content_json AS "contentJson",
                    button_label AS "buttonLabel", footer_text AS "footerText",
                    template_version AS "templateVersion", is_system_default AS "isSystemDefault",
                    is_active AS "isActive", updated_at AS "updatedAt"`,
          [name, title, messageBody, JSON.stringify(variables), storeName, themeColor, JSON.stringify(contentJson), buttonLabel, footerText, auth.session.userId, isActive, existing.rows[0].id, auth.session.tenantId]
        )
      : await client.query(
          `INSERT INTO notification_templates
             (tenant_id, name, channel, trigger_type, title, body, variables, store_name,
              theme_color, content_json, button_label, footer_text, template_version,
              is_system_default, updated_by, is_active)
           VALUES ($1,$2,$3,'before_expiry',$4,$5,$6::jsonb,$7,$8,$9::jsonb,$10,$11,1,false,$12,$13)
           RETURNING id, name, channel, title, body, variables, store_name AS "storeName",
                     theme_color AS "themeColor", content_json AS "contentJson",
                     button_label AS "buttonLabel", footer_text AS "footerText",
                     template_version AS "templateVersion", is_system_default AS "isSystemDefault",
                     is_active AS "isActive", updated_at AS "updatedAt"`,
          [auth.session.tenantId, name, channel, title, messageBody, JSON.stringify(variables), storeName, themeColor, JSON.stringify(contentJson), buttonLabel, footerText, auth.session.userId, isActive]
        );
    const templateId = template.rows[0].id;
    await client.query(
      `INSERT INTO renewal_message_templates
         (tenant_id,source_template_id,channel,name,subject,body,is_default,is_active)
       VALUES ($1,$2,$3,$4,$5,$6,true,$7)
       ON CONFLICT (tenant_id,channel) WHERE is_default=true DO UPDATE SET
         source_template_id=EXCLUDED.source_template_id,name=EXCLUDED.name,subject=EXCLUDED.subject,
         body=EXCLUDED.body,is_active=EXCLUDED.is_active,updated_at=now()`,
      [auth.session.tenantId, templateId, channel, name,
        channel === "email" ? canonicalTemplateVariables(title) : null,
        canonicalTemplateVariables(messageBody), isActive]
    );
    const existingRule = await client.query("SELECT id FROM automation_rules WHERE tenant_id = $1 AND template_id = $2 LIMIT 1", [auth.session.tenantId, templateId]);
    const rule = existingRule.rows[0]
      ? await client.query(
          `UPDATE automation_rules SET channel = $1, days_offset = $2, is_active = $3, updated_at = now()
            WHERE id = $4 AND tenant_id = $5
          RETURNING id, template_id AS "templateId", lower(channel) AS channel,
                    days_offset AS "daysOffset", is_active AS "isActive"`,
          [channel, daysOffset, isActive, existingRule.rows[0].id, auth.session.tenantId]
        )
      : await client.query(
          `INSERT INTO automation_rules (tenant_id, name, channel, trigger_type, days_offset, template_id, is_active)
           VALUES ($1, $2, $3, 'before_expiry', $4, $5, $6)
           RETURNING id, template_id AS "templateId", lower(channel) AS channel,
                     days_offset AS "daysOffset", is_active AS "isActive"`,
          [auth.session.tenantId, `${name} rule`, channel, daysOffset, templateId, isActive]
        );
    await client.query(
      "INSERT INTO activity_logs (tenant_id, user_id, type, title, metadata) VALUES ($1, $2, 'template.updated', 'Renewal template updated', $3::jsonb)",
      [auth.session.tenantId, auth.session.userId, JSON.stringify({ templateId, channel, daysOffset, templateVersion: template.rows[0].templateVersion })]
    );
    return { template: template.rows[0], rule: rule.rows[0] };
  });
  return Response.json({ ok: true, ...saved });
}

export async function POST(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const input = await req.json().catch(() => ({}));
  const to = String(input.to || "").trim().toLowerCase();
  if (!emailPattern.test(to)) return Response.json({ ok: false, message: "أدخل بريدًا إلكترونيًا صحيحًا" }, { status: 400 });

  const recent = await query(
    `SELECT count(*)::int AS count FROM activity_logs
      WHERE tenant_id = $1 AND user_id = $2 AND type = 'template.test_email'
        AND created_at > now() - interval '10 minutes'`,
    [auth.session.tenantId, auth.session.userId]
  );
  if (recent.rows[0].count >= 5) {
    return Response.json({ ok: false, message: "تم بلوغ حد الاختبارات. حاول بعد عشر دقائق." }, { status: 429 });
  }

  const template = {
    name: sanitizePlainText(input.name, 120) || defaultEmailTemplate.name,
    title: sanitizePlainText(input.title, 180) || defaultEmailTemplate.title,
    body: sanitizePlainText(input.body, 8000) || defaultEmailTemplate.body,
    storeName: sanitizePlainText(input.storeName, 100) || defaultEmailTemplate.storeName,
    themeColor: colorPattern.test(String(input.themeColor || "")) ? String(input.themeColor).toUpperCase() : defaultEmailTemplate.themeColor,
    buttonLabel: sanitizePlainText(input.buttonLabel, 80) || defaultEmailTemplate.buttonLabel,
    footerText: sanitizePlainText(input.footerText, 300) || defaultEmailTemplate.footerText
  };
  if (![template.title, template.body, template.buttonLabel, template.footerText].every((value) => hasOnlyAllowedVariables(value, emailVariables))) {
    return Response.json({ ok: false, message: "يحتوي القالب على متغير غير معتمد" }, { status: 400 });
  }

  let reservation;
  try {
    reservation = await reserveMessageQuota({
      tenantId: auth.session.tenantId,
      channelType: "email",
      quantity: 1,
      isBillable: true
    });
  } catch (error) {
    if (error?.code === PLAN_MESSAGE_LIMIT_REACHED) {
      return Response.json({ ok: false, code: PLAN_MESSAGE_LIMIT_REACHED, reason: PLAN_MESSAGE_LIMIT_REACHED, usage: error.usage, message: error.message }, { status: 409 });
    }
    throw error;
  }

  try {
    const testTemplate = {
      ...template,
      title: `[اختبار Renvix] ${template.title}`,
      body: `هذه رسالة اختبار من Renvix ولا تخص اشتراكًا فعليًا.\n\n${template.body}`
    };
    const sent = await sendRenewalReminderEmail({
      to,
      customerName: "مستلم الاختبار",
      serviceName: "رسالة اختبار",
      endDate: "—",
      remainingDays: 0,
      renewalLink: "https://renvix.app",
      orderNumber: "TEST",
      template: testTemplate
    });
    await transaction(async (client) => {
      await client.query(
        `INSERT INTO activity_logs (tenant_id, user_id, type, title, metadata)
         VALUES ($1,$2,'template.test_email','Renewal email template test sent',$3::jsonb)`,
        [auth.session.tenantId, auth.session.userId, JSON.stringify({ to, providerMessageId: sent?.id || null })]
      );
      await client.query(
        `INSERT INTO email_logs (tenant_id, to_email, subject, body, provider_message_id, status, sent_at)
         VALUES ($1,$2,$3,$4,$5,'sent',now())`,
        [auth.session.tenantId, to, testTemplate.title, testTemplate.body, sent?.id || null]
      );
      await consumeReservedQuotaWithClient(client, {
        periodId: reservation.periodId,
        channelType: "email",
        quantity: 1
      });
    });
    return Response.json({ ok: true, providerMessageId: sent?.id || null });
  } catch (error) {
    await releaseReservedQuota({ periodId: reservation.periodId }).catch(() => null);
    await query(
      `INSERT INTO activity_logs (tenant_id, user_id, type, title, metadata)
       VALUES ($1,$2,'template.test_email_failed','Renewal email template test failed',$3::jsonb)`,
      [auth.session.tenantId, auth.session.userId, JSON.stringify({ to, error: safeErrorMessage(error) })]
    ).catch(() => null);
    return Response.json({ ok: false, message: "تعذر إرسال الرسالة التجريبية. تحقق من إعدادات البريد." }, { status: 502 });
  }
}
