import { z } from "zod";
import { decryptSecret } from "../lib/encryption.js";
import { query, transaction } from "./db.js";

export const META_TEMPLATE_STATUSES = Object.freeze({
  DRAFT: "draft",
  SUBMITTING: "submitting",
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  PAUSED: "paused",
  DISABLED: "disabled",
  ERROR: "error"
});

const buttonSchema = z.object({
  type: z.string().trim().min(1).max(40),
  text: z.string().trim().min(1).max(80),
  url: z.string().trim().url().max(2048).optional(),
  phone_number: z.string().trim().max(40).optional(),
  example: z.union([z.string(), z.array(z.string())]).optional()
}).strict();

const componentSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("HEADER"),
    format: z.enum(["TEXT", "IMAGE", "VIDEO", "DOCUMENT"]),
    text: z.string().trim().max(1024).optional(),
    example: z.unknown().optional()
  }).strict(),
  z.object({
    type: z.literal("BODY"),
    text: z.string().trim().min(1).max(4096),
    example: z.object({ body_text: z.array(z.array(z.string().max(500))).max(20) }).strict().optional()
  }).strict(),
  z.object({
    type: z.literal("FOOTER"),
    text: z.string().trim().min(1).max(1024)
  }).strict(),
  z.object({
    type: z.literal("BUTTONS"),
    buttons: z.array(buttonSchema).min(1).max(10)
  }).strict()
]);

export const metaTemplateDraftSchema = z.object({
  integrationId: z.string().uuid().optional(),
  name: z.string().trim().toLowerCase()
    .min(1).max(512)
    .regex(/^[a-z0-9_]+$/, "اسم القالب يقبل أحرفًا إنجليزية صغيرة وأرقامًا وشرطة سفلية فقط"),
  language: z.string().trim().min(2).max(20).regex(/^[a-z]{2,3}(?:_[A-Z]{2})?$/),
  category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]),
  components: z.array(componentSchema).min(1).max(8)
}).superRefine((value, context) => {
  const bodies = value.components.filter((component) => component.type === "BODY");
  if (bodies.length !== 1) {
    context.addIssue({ code: "custom", path: ["components"], message: "يجب أن يحتوي القالب على نص رئيسي واحد" });
  }
});

function templateSelect() {
  return `SELECT mt.id, mt.meta_integration_id AS "integrationId",
    mt.meta_template_id AS "metaTemplateId", mt.template_name AS name,
    mt.language, mt.requested_category AS category,
    mt.approved_category AS "approvedCategory", mt.components,
    mt.local_status AS status, mt.meta_status AS "metaStatus",
    mt.rejection_reason AS "rejectionReason", mt.quality_rating AS "qualityRating",
    mt.submitted_at AS "submittedAt", mt.approved_at AS "approvedAt",
    mt.rejected_at AS "rejectedAt", mt.created_at AS "createdAt",
    mt.updated_at AS "updatedAt", wc.display_name AS "channelName",
    wc.phone_number AS "phoneNumber"
    FROM meta_message_templates mt
    JOIN whatsapp_channels wc ON wc.id=mt.meta_integration_id AND wc.tenant_id=mt.tenant_id`;
}

function integrationSelect() {
  return `SELECT id, display_name AS "channelName", phone_number AS "phoneNumber",
    status, waba_id AS "wabaId", phone_number_id AS "phoneNumberId"
    FROM whatsapp_channels
    WHERE tenant_id=$1 AND provider IN ('meta','meta_cloud_api')
    ORDER BY CASE status WHEN 'connected' THEN 0 ELSE 1 END, updated_at DESC`;
}

export async function listMetaTemplates(tenantId) {
  const [templates, integrations] = await Promise.all([
    query(`${templateSelect()} WHERE mt.tenant_id=$1 ORDER BY mt.updated_at DESC`, [tenantId]),
    query(integrationSelect(), [tenantId])
  ]);
  return { items: templates.rows, integrations: integrations.rows };
}

async function chooseIntegration(client, tenantId, integrationId) {
  const values = [tenantId];
  let condition = "";
  if (integrationId) {
    values.push(integrationId);
    condition = ` AND id=$${values.length}`;
  }
  const result = await client.query(
    `SELECT id, provider, status, waba_id, channel_token_encrypted
       FROM whatsapp_channels
      WHERE tenant_id=$1 AND provider IN ('meta','meta_cloud_api')${condition}
      ORDER BY CASE status WHEN 'connected' THEN 0 ELSE 1 END, updated_at DESC LIMIT 1`,
    values
  );
  return result.rows[0] || null;
}

export async function createMetaTemplateDraft({ tenantId, userId, input }) {
  const parsed = metaTemplateDraftSchema.safeParse(input);
  if (!parsed.success) {
    const error = new Error(parsed.error.issues[0]?.message || "بيانات القالب غير صالحة");
    error.code = "INVALID_META_TEMPLATE";
    error.status = 400;
    throw error;
  }
  return transaction(async (client) => {
    const integration = await chooseIntegration(client, tenantId, parsed.data.integrationId);
    if (!integration) {
      const error = new Error("اربط حساب واتساب رسميًا عبر Meta Cloud API قبل إنشاء القالب.");
      error.code = "META_INTEGRATION_REQUIRED";
      error.status = 409;
      throw error;
    }
    const saved = await client.query(
      `INSERT INTO meta_message_templates (
         tenant_id, meta_integration_id, template_name, language,
         requested_category, components, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)
       RETURNING id`,
      [tenantId, integration.id, parsed.data.name, parsed.data.language,
        parsed.data.category, JSON.stringify(parsed.data.components), userId]
    );
    await client.query(
      `INSERT INTO activity_logs (tenant_id,user_id,type,title,metadata)
       VALUES ($1,$2,'meta_template.draft_created','Meta WhatsApp template draft created',$3::jsonb)`,
      [tenantId, userId, JSON.stringify({ templateId: saved.rows[0].id })]
    );
    const result = await client.query(`${templateSelect()} WHERE mt.tenant_id=$1 AND mt.id=$2`, [tenantId, saved.rows[0].id]);
    return result.rows[0];
  });
}

export async function updateMetaTemplateDraft({ tenantId, userId, templateId, input }) {
  const parsed = metaTemplateDraftSchema.safeParse(input);
  if (!parsed.success) {
    const error = new Error(parsed.error.issues[0]?.message || "بيانات القالب غير صالحة");
    error.status = 400;
    throw error;
  }
  return transaction(async (client) => {
    const locked = await client.query(
      `SELECT id, local_status FROM meta_message_templates
        WHERE id=$1 AND tenant_id=$2 FOR UPDATE`,
      [templateId, tenantId]
    );
    if (!locked.rows[0]) return null;
    if (!["draft", "rejected", "error"].includes(locked.rows[0].local_status)) {
      const error = new Error("لا يمكن تعديل قالب قيد المراجعة أو معتمد. أنشئ مسودة جديدة للتعديل.");
      error.status = 409;
      throw error;
    }
    const integration = await chooseIntegration(client, tenantId, parsed.data.integrationId);
    if (!integration) {
      const error = new Error("تكامل Meta المحدد غير متاح.");
      error.status = 409;
      throw error;
    }
    await client.query(
      `UPDATE meta_message_templates SET meta_integration_id=$3,template_name=$4,
       language=$5,requested_category=$6,components=$7::jsonb,
       local_status='draft',meta_status=NULL,rejection_reason=NULL,updated_at=now()
       WHERE id=$1 AND tenant_id=$2`,
      [templateId, tenantId, integration.id, parsed.data.name, parsed.data.language,
        parsed.data.category, JSON.stringify(parsed.data.components)]
    );
    await client.query(
      `INSERT INTO activity_logs (tenant_id,user_id,type,title,metadata)
       VALUES ($1,$2,'meta_template.draft_updated','Meta WhatsApp template draft updated',$3::jsonb)`,
      [tenantId, userId, JSON.stringify({ templateId })]
    );
    const result = await client.query(`${templateSelect()} WHERE mt.tenant_id=$1 AND mt.id=$2`, [tenantId, templateId]);
    return result.rows[0];
  });
}

function graphConfiguration(channel) {
  const version = String(process.env.META_GRAPH_API_VERSION || "");
  if (!/^v\d+\.\d+$/.test(version)) {
    const error = new Error("اضبط META_GRAPH_API_VERSION بإصدار Graph API المعتمد في بيئتك.");
    error.code = "META_GRAPH_VERSION_REQUIRED";
    error.status = 503;
    throw error;
  }
  if (!channel.waba_id || !channel.channel_token_encrypted) {
    const error = new Error("تكامل Meta غير مكتمل: يلزم WABA ID ورمز وصول مشفّر.");
    error.code = "META_INTEGRATION_INCOMPLETE";
    error.status = 409;
    throw error;
  }
  return {
    version,
    wabaId: channel.waba_id,
    accessToken: decryptSecret(channel.channel_token_encrypted, process.env.ENCRYPTION_KEY)
  };
}

async function graphRequest({ method = "GET", path, accessToken, body }) {
  const response = await fetch(`https://graph.facebook.com/${path}`, {
    method,
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: "application/json",
      ...(body ? { "content-type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(String(payload?.error?.message || `Meta Graph API failed (${response.status})`).slice(0, 500));
    error.code = "META_GRAPH_ERROR";
    error.status = 502;
    throw error;
  }
  return payload;
}

export async function submitMetaTemplate({ tenantId, userId, templateId }) {
  const prepared = await transaction(async (client) => {
    const result = await client.query(
      `SELECT mt.*, wc.provider, wc.status AS channel_status, wc.waba_id,
              wc.channel_token_encrypted
         FROM meta_message_templates mt
         JOIN whatsapp_channels wc ON wc.id=mt.meta_integration_id AND wc.tenant_id=mt.tenant_id
        WHERE mt.id=$1 AND mt.tenant_id=$2 FOR UPDATE OF mt`,
      [templateId, tenantId]
    );
    const row = result.rows[0];
    if (!row) return null;
    if (!["draft", "rejected", "error"].includes(row.local_status)) {
      const error = new Error("القالب أُرسل مسبقًا أو لا تسمح حالته الحالية بإعادة الإرسال.");
      error.status = 409;
      throw error;
    }
    if (row.channel_status !== "connected") {
      const error = new Error("قناة Meta غير متصلة حاليًا.");
      error.status = 409;
      throw error;
    }
    await client.query(
      "UPDATE meta_message_templates SET local_status='submitting',rejection_reason=NULL,updated_at=now() WHERE id=$1",
      [templateId]
    );
    return row;
  });
  if (!prepared) return null;

  try {
    const config = graphConfiguration(prepared);
    const payload = await graphRequest({
      method: "POST",
      path: `${config.version}/${encodeURIComponent(config.wabaId)}/message_templates`,
      accessToken: config.accessToken,
      body: {
        name: prepared.template_name,
        language: prepared.language,
        category: prepared.requested_category,
        components: prepared.components
      }
    });
    return transaction(async (client) => {
      await client.query(
        `UPDATE meta_message_templates SET meta_template_id=$3,
         local_status='pending',meta_status=COALESCE($4,'PENDING'),
         submitted_at=now(),updated_at=now() WHERE id=$1 AND tenant_id=$2`,
        [templateId, tenantId, payload.id || null, String(payload.status || "PENDING").toUpperCase()]
      );
      await client.query(
        `INSERT INTO activity_logs (tenant_id,user_id,type,title,metadata)
         VALUES ($1,$2,'meta_template.submitted','Meta WhatsApp template submitted',$3::jsonb)`,
        [tenantId, userId, JSON.stringify({ templateId, metaTemplateId: payload.id || null })]
      );
      const result = await client.query(`${templateSelect()} WHERE mt.tenant_id=$1 AND mt.id=$2`, [tenantId, templateId]);
      return result.rows[0];
    });
  } catch (error) {
    await query(
      `UPDATE meta_message_templates SET local_status='error',
       rejection_reason=$3,updated_at=now() WHERE id=$1 AND tenant_id=$2`,
      [templateId, tenantId, String(error.message || "Meta submission failed").slice(0, 500)]
    );
    throw error;
  }
}

function localStatus(metaStatus) {
  const normalized = String(metaStatus || "").toUpperCase();
  if (normalized === "APPROVED") return "approved";
  if (normalized === "REJECTED") return "rejected";
  if (normalized === "PAUSED") return "paused";
  if (normalized === "DISABLED") return "disabled";
  return "pending";
}

export async function applyMetaTemplateStatus({
  wabaId, templateId, name, language, status, category, reason, qualityRating
}) {
  const channel = await query(
    `SELECT id,tenant_id FROM whatsapp_channels
      WHERE waba_id=$1 AND provider IN ('meta','meta_cloud_api') LIMIT 1`,
    [wabaId]
  );
  if (!channel.rows[0]) return { changed: false };
  const mapped = localStatus(status);
  return transaction(async (client) => {
    const values = [channel.rows[0].tenant_id, channel.rows[0].id];
    const matches = ["tenant_id=$1", "meta_integration_id=$2"];
    if (templateId) {
      values.push(String(templateId));
      matches.push(`meta_template_id=$${values.length}`);
    } else {
      values.push(String(name || ""));
      matches.push(`template_name=$${values.length}`);
      if (language) {
        values.push(String(language));
        matches.push(`language=$${values.length}`);
      }
    }
    const found = await client.query(
      `SELECT id,local_status FROM meta_message_templates WHERE ${matches.join(" AND ")} FOR UPDATE`,
      values
    );
    if (!found.rows[0]) return { changed: false };
    await client.query(
      `UPDATE meta_message_templates SET meta_status=$3,local_status=$4,
       approved_category=COALESCE($5,approved_category),rejection_reason=$6,
       quality_rating=COALESCE($7,quality_rating),
       approved_at=CASE WHEN $4='approved' THEN now() ELSE approved_at END,
       rejected_at=CASE WHEN $4='rejected' THEN now() ELSE rejected_at END,
       updated_at=now() WHERE id=$1 AND tenant_id=$2`,
      [found.rows[0].id, channel.rows[0].tenant_id, String(status || "").toUpperCase(),
        mapped, category ? String(category).toUpperCase() : null,
        mapped === "rejected" ? String(reason || "لم تُرسل Meta سببًا تفصيليًا.").slice(0, 500) : null,
        qualityRating ? String(qualityRating).slice(0, 80) : null]
    );
    const approved = mapped === "approved";
    const rejected = mapped === "rejected";
    if (approved || rejected) {
      await client.query(
        `INSERT INTO in_app_notifications (
           tenant_id,type,title,message,entity_type,entity_id,priority,action_url,metadata,dedupe_key
         ) VALUES ($1,$2,$3,$4,'meta_template',$5,$6,'/dashboard/templates',$7::jsonb,$8)
         ON CONFLICT (tenant_id,dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING`,
        [channel.rows[0].tenant_id,
          approved ? "meta_template_approved" : "meta_template_rejected",
          approved ? "تم اعتماد قالب واتساب بنجاح" : "تم رفض قالب واتساب",
          approved ? "أصبح القالب جاهزًا للاستخدام." : "راجع سبب الرفض وعدّل المحتوى ثم أرسله مرة أخرى.",
          found.rows[0].id, approved ? "normal" : "high",
          JSON.stringify({ metaStatus: status, reason: rejected ? reason || null : null }),
          `meta-template:${found.rows[0].id}:${String(status || "").toUpperCase()}`]
      );
    }
    return { changed: true, tenantId: channel.rows[0].tenant_id, templateId: found.rows[0].id };
  });
}

export async function syncMetaTemplates({ tenantId, userId }) {
  const integrations = await query(
    `SELECT id,waba_id,channel_token_encrypted,status FROM whatsapp_channels
      WHERE tenant_id=$1 AND provider IN ('meta','meta_cloud_api')
        AND status='connected' AND waba_id IS NOT NULL`,
    [tenantId]
  );
  let updated = 0;
  for (const integration of integrations.rows) {
    const config = graphConfiguration(integration);
    const params = new URLSearchParams({
      fields: "id,name,language,status,category,rejected_reason,quality_score",
      limit: "250"
    });
    const payload = await graphRequest({
      path: `${config.version}/${encodeURIComponent(config.wabaId)}/message_templates?${params}`,
      accessToken: config.accessToken
    });
    for (const item of Array.isArray(payload.data) ? payload.data : []) {
      const result = await applyMetaTemplateStatus({
        wabaId: config.wabaId,
        templateId: item.id,
        name: item.name,
        language: item.language,
        status: item.status,
        category: item.category,
        reason: item.rejected_reason,
        qualityRating: item.quality_score?.score || item.quality_score
      });
      if (result.changed) updated += 1;
    }
  }
  await query(
    `INSERT INTO activity_logs (tenant_id,user_id,type,title,metadata)
     VALUES ($1,$2,'meta_template.synced','Meta WhatsApp templates synchronized',$3::jsonb)`,
    [tenantId, userId, JSON.stringify({ updated, integrations: integrations.rowCount })]
  );
  return { updated, integrations: integrations.rowCount };
}
