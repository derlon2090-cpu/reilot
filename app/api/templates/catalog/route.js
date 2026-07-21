import { query, transaction } from "../../../../src/server/db.js";
import { ensureDefaultTemplates, TEMPLATE_KEYS } from "../../../../src/server/default-templates.js";
import { requireSession } from "../../../../src/server/session.js";

const catalogKeys = [
  TEMPLATE_KEYS.WHATSAPP_MENU,
  TEMPLATE_KEYS.EMAIL_DELIVERY,
  TEMPLATE_KEYS.RENEWAL_WHATSAPP,
  TEMPLATE_KEYS.SALLA_FULFILLED
];
const allowedKeys = new Set(catalogKeys);
const allowedVariables = {
  [TEMPLATE_KEYS.WHATSAPP_MENU]: new Set(["customer_name", "store_name"]),
  [TEMPLATE_KEYS.EMAIL_DELIVERY]: new Set(["customer_name", "order_number", "order_portal_url", "store_name"]),
  [TEMPLATE_KEYS.RENEWAL_WHATSAPP]: new Set(["customer_name", "service_name", "expiry_date", "days_remaining", "renewal_url", "store_name", "order_number"]),
  [TEMPLATE_KEYS.SALLA_FULFILLED]: new Set(["customer_name", "order_number", "order_portal_url", "store_name"])
};

function sanitizeText(value, maxLength, required = true) {
  const text = String(value || "").replace(/\r\n?/g, "\n").trim();
  if ((required && !text) || text.length > maxLength) return null;
  if (/<\/?[a-z][^>]*>/i.test(text) || /javascript\s*:/i.test(text) || /<script|<iframe/i.test(text)) return null;
  return text;
}

function hasAllowedVariables(value, allowed) {
  return [...String(value || "").matchAll(/{{\s*([^{}]+?)\s*}}/g)].every((match) => allowed.has(match[1]));
}

function normalizeMenuContent(value) {
  const source = value && typeof value === "object" ? value : {};
  const sections = Array.isArray(source.sections) ? source.sections.slice(0, 4).map((section, sectionIndex) => ({
    title: sanitizeText(section?.title, 60) || `القسم ${sectionIndex + 1}`,
    rows: (Array.isArray(section?.rows) ? section.rows : []).slice(0, 10).map((row, rowIndex) => ({
      id: String(row?.id || `option_${sectionIndex + 1}_${rowIndex + 1}`).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60),
      title: sanitizeText(row?.title, 60) || `الخيار ${rowIndex + 1}`,
      description: sanitizeText(row?.description, 120, false) || ""
    }))
  })) : [];
  return { sections: sections.length ? sections : [{ title: "الخدمات", rows: [] }] };
}

function selectCatalogTemplates() {
  return `SELECT id,template_key AS "templateKey",template_group AS "templateGroup",name,channel,trigger_type AS "triggerType",
    title,body,variables,content_json AS "contentJson",button_label AS "buttonLabel",footer_text AS "footerText",
    theme_color AS "themeColor",template_version AS "templateVersion",is_system_default AS "isSystemDefault",
    is_active AS "isActive",updated_at AS "updatedAt"
    FROM notification_templates WHERE tenant_id=$1 AND template_key=ANY($2::text[])
    ORDER BY array_position($2::text[],template_key)`;
}

export async function GET(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  await transaction((client) => ensureDefaultTemplates(client, auth.session.tenantId));
  const result = await query(selectCatalogTemplates(), [auth.session.tenantId, catalogKeys]);
  return Response.json({ ok: true, items: result.rows }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

export async function PUT(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const input = await req.json().catch(() => ({}));
  const templateKey = String(input.templateKey || "");
  if (!allowedKeys.has(templateKey)) return Response.json({ ok: false, message: "نوع القالب غير معتمد" }, { status: 400 });
  const name = sanitizeText(input.name, 120);
  const body = sanitizeText(input.body, 8000);
  const title = sanitizeText(input.title, 180, false);
  const buttonLabel = sanitizeText(input.buttonLabel, 80, false);
  const footerText = sanitizeText(input.footerText, 300, false);
  const allowed = allowedVariables[templateKey];
  if (!name || !body || ![title, body, buttonLabel, footerText].every((value) => hasAllowedVariables(value, allowed))) {
    return Response.json({ ok: false, message: "تحقق من محتوى القالب والمتغيرات المستخدمة" }, { status: 400 });
  }
  const contentJson = templateKey === TEMPLATE_KEYS.WHATSAPP_MENU
    ? normalizeMenuContent(input.contentJson)
    : templateKey === TEMPLATE_KEYS.SALLA_FULFILLED ? { lockedPortalLink: true } : {};
  const themeColor = /^#[0-9a-f]{6}$/i.test(String(input.themeColor || "")) ? String(input.themeColor).toUpperCase() : "#0EA5A8";
  const saved = await transaction(async (client) => {
    await ensureDefaultTemplates(client, auth.session.tenantId);
    const result = await client.query(`UPDATE notification_templates SET name=$1,title=$2,body=$3,content_json=$4::jsonb,
      button_label=$5,footer_text=$6,theme_color=$7,is_active=$8,is_system_default=false,
      template_version=template_version+1,updated_by=$9,updated_at=now()
      WHERE tenant_id=$10 AND template_key=$11
      RETURNING id,template_key AS "templateKey",template_group AS "templateGroup",name,channel,
        trigger_type AS "triggerType",title,body,variables,content_json AS "contentJson",button_label AS "buttonLabel",
        footer_text AS "footerText",theme_color AS "themeColor",template_version AS "templateVersion",
        is_system_default AS "isSystemDefault",is_active AS "isActive",updated_at AS "updatedAt"`,
    [name, title, body, JSON.stringify(contentJson), buttonLabel, footerText, themeColor, input.isActive !== false,
      auth.session.userId, auth.session.tenantId, templateKey]);
    await client.query("INSERT INTO activity_logs (tenant_id,user_id,type,title,metadata) VALUES($1,$2,'template.updated','Catalog template updated',$3::jsonb)",
      [auth.session.tenantId, auth.session.userId, JSON.stringify({ templateKey, templateVersion: result.rows[0]?.templateVersion })]);
    return result.rows[0];
  });
  return Response.json({ ok: true, item: saved });
}
