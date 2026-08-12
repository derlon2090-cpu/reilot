import { query } from "./db.js";
import { SALLA_TEMPLATE_DEFINITIONS } from "./salla-templates.js";

const PREFIX = "platform_salla_default_";

export function platformSallaTemplateKey(templateKey, channel) {
  return `${PREFIX}${templateKey}_${channel}`;
}

export function mergeSallaAdminCatalog(rows = []) {
  const overrides = new Map(rows.map((row) => [row.templateKey, row]));
  return SALLA_TEMPLATE_DEFINITIONS.map((definition) => {
    const whatsapp = overrides.get(platformSallaTemplateKey(definition.key, "whatsapp"));
    const email = overrides.get(platformSallaTemplateKey(definition.key, "email"));
    const latest = [whatsapp, email]
      .filter(Boolean)
      .sort((left, right) => new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime())[0] || null;
    const selectedChannel = latest?.templateKey === platformSallaTemplateKey(definition.key, "email") ? "email" : "whatsapp";
    return {
      templateKey: definition.key,
      name: definition.name,
      description: definition.description,
      icon: definition.icon,
      previewAction: definition.previewAction,
      variables: definition.variables,
      isEnabled: latest?.isActive !== false,
      channel: selectedChannel,
      whatsappContent: whatsapp?.body || definition.body,
      emailTextContent: email?.body || definition.body,
      emailHtmlContent: email?.settings?.emailHtmlContent || "",
      emailSubject: email?.subject || definition.emailSubject || definition.name,
      settings: { ...(definition.settings || {}), ...(whatsapp?.settings || {}), ...(email?.settings || {}), ...(latest?.settings || {}) },
      updatedAt: [whatsapp?.updatedAt, email?.updatedAt].filter(Boolean).sort().at(-1) || null
    };
  });
}

export async function listSallaAdminCatalog(client = { query }) {
  const keys = SALLA_TEMPLATE_DEFINITIONS.flatMap((definition) => [
    platformSallaTemplateKey(definition.key, "whatsapp"),
    platformSallaTemplateKey(definition.key, "email")
  ]);
  const result = await client.query(
    `SELECT template_key AS "templateKey",subject,body,settings,is_active AS "isActive",updated_at AS "updatedAt"
       FROM admin_message_templates
      WHERE template_key=ANY($1::text[])`,
    [keys]
  );
  return mergeSallaAdminCatalog(result.rows);
}

export async function saveSallaAdminTemplate({ adminId, templateKey, channel, subject, body, isEnabled = true, settings = {} }) {
  const definition = SALLA_TEMPLATE_DEFINITIONS.find((item) => item.key === templateKey);
  if (!definition) return null;
  const storageChannel = channel === "email" ? "email" : "evolution_whatsapp";
  const key = platformSallaTemplateKey(templateKey, channel);
  const result = await query(
    `INSERT INTO admin_message_templates
     (template_key,name,description,channel,subject,body,allowed_variables,required_variables,settings,
        is_system_template,is_active,updated_by_admin_user_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,'[]'::jsonb,$8::jsonb,true,$9,$10)
     ON CONFLICT (template_key) DO UPDATE SET
       name=EXCLUDED.name,description=EXCLUDED.description,channel=EXCLUDED.channel,
       subject=EXCLUDED.subject,body=EXCLUDED.body,allowed_variables=EXCLUDED.allowed_variables,
       settings=EXCLUDED.settings,
       is_active=EXCLUDED.is_active,version=admin_message_templates.version+1,
       updated_by_admin_user_id=EXCLUDED.updated_by_admin_user_id,updated_at=now()
     RETURNING template_key AS "templateKey",subject,body,updated_at AS "updatedAt"`,
    [
      key,
      `${definition.name} — ${channel === "email" ? "البريد" : "واتساب"}`,
      `الإعداد الافتراضي لمنصة سلة: ${definition.description}`,
      storageChannel,
      channel === "email" ? subject : null,
      body,
      JSON.stringify(definition.variables),
      JSON.stringify(settings && typeof settings === "object" ? settings : {}),
      Boolean(isEnabled),
      adminId
    ]
  );
  return result.rows[0];
}
