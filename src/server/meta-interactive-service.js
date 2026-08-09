import crypto from "node:crypto";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { z } from "zod";
import { decryptSecret } from "../lib/encryption.js";
import { enforceActivityRateLimit } from "./campaign-contacts.js";
import { query, transaction } from "./db.js";

const actionSchema = z.object({
  id: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(200).optional(),
  actionType: z.enum(["reply", "open_url", "open_section", "start_flow"]),
  actionValue: z.string().trim().max(2048).optional()
}).strict();

const listDefinitionSchema = z.object({
  body: z.string().trim().min(1).max(1024),
  footer: z.string().trim().max(60).optional(),
  buttonText: z.string().trim().min(1).max(20),
  sections: z.array(z.object({
    id: z.string().trim().min(1).max(200),
    title: z.string().trim().min(1).max(24),
    rows: z.array(actionSchema).min(1).max(10)
  }).strict()).min(1).max(10)
}).strict().superRefine((definition, context) => {
  const ids = definition.sections.flatMap((section) => section.rows.map((row) => row.id));
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: "custom", path: ["sections"], message: "معرّفات خيارات القائمة يجب ألا تتكرر." });
  }
});

const replyButtonsDefinitionSchema = z.object({
  body: z.string().trim().min(1).max(1024),
  footer: z.string().trim().max(60).optional(),
  buttons: z.array(actionSchema.omit({ description: true })).min(1).max(3)
}).strict().superRefine((definition, context) => {
  const ids = definition.buttons.map((button) => button.id);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({ code: "custom", path: ["buttons"], message: "معرّفات أزرار الرد يجب ألا تتكرر." });
  }
});

const urlButtonDefinitionSchema = z.object({
  body: z.string().trim().min(1).max(1024),
  footer: z.string().trim().max(60).optional(),
  displayText: z.string().trim().min(1).max(20),
  url: z.string().trim().url().max(2048)
}).strict();

export const interactiveMessageSchema = z.discriminatedUnion("interactiveType", [
  z.object({
    channelId: z.string().uuid(),
    name: z.string().trim().min(1).max(160),
    interactiveType: z.literal("list"),
    definition: listDefinitionSchema,
    status: z.enum(["draft", "active", "archived"]).default("draft")
  }).strict(),
  z.object({
    channelId: z.string().uuid(),
    name: z.string().trim().min(1).max(160),
    interactiveType: z.literal("reply_buttons"),
    definition: replyButtonsDefinitionSchema,
    status: z.enum(["draft", "active", "archived"]).default("draft")
  }).strict(),
  z.object({
    channelId: z.string().uuid(),
    name: z.string().trim().min(1).max(160),
    interactiveType: z.literal("url_button"),
    definition: urlButtonDefinitionSchema,
    status: z.enum(["draft", "active", "archived"]).default("draft")
  }).strict()
]);

function invalidInput(parsed) {
  const error = new Error(parsed.error.issues[0]?.message || "بيانات الرسالة التفاعلية غير صالحة.");
  error.code = "INVALID_INTERACTIVE_MESSAGE";
  error.status = 400;
  return error;
}

function selectInteractive() {
  return `SELECT im.id,im.channel_id AS "channelId",im.name,
    im.interactive_type AS "interactiveType",im.definition,im.status,
    im.created_at AS "createdAt",im.updated_at AS "updatedAt",
    wc.display_name AS "channelName",wc.phone_number AS "phoneNumber",
    wc.status AS "channelStatus"
    FROM whatsapp_interactive_messages im
    JOIN whatsapp_channels wc ON wc.id=im.channel_id AND wc.tenant_id=im.tenant_id`;
}

async function assertChannel(client, tenantId, channelId) {
  const result = await client.query(
    `SELECT id,provider,status,phone_number_id,channel_token_encrypted
       FROM whatsapp_channels
      WHERE id=$1 AND tenant_id=$2 AND provider IN ('meta','meta_cloud_api')`,
    [channelId, tenantId]
  );
  if (!result.rows[0]) {
    throw Object.assign(new Error("قناة Meta المحددة غير موجودة في مساحة العمل."), {
      code: "META_CHANNEL_NOT_FOUND",
      status: 409
    });
  }
  return result.rows[0];
}

export async function listInteractiveMessages(tenantId) {
  const result = await query(`${selectInteractive()} WHERE im.tenant_id=$1 ORDER BY im.updated_at DESC`, [tenantId]);
  return result.rows;
}

export async function createInteractiveMessage({ tenantId, userId, input }) {
  const parsed = interactiveMessageSchema.safeParse(input);
  if (!parsed.success) throw invalidInput(parsed);
  return transaction(async (client) => {
    if (!await enforceActivityRateLimit(client, {
      tenantId, userId, action: "meta_interactive.created", limit: 20
    })) {
      throw Object.assign(new Error("محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة."), { status: 429 });
    }
    await assertChannel(client, tenantId, parsed.data.channelId);
    const inserted = await client.query(
      `INSERT INTO whatsapp_interactive_messages
         (tenant_id,channel_id,name,interactive_type,definition,status,created_by)
       VALUES($1,$2,$3,$4,$5::jsonb,$6,$7) RETURNING id`,
      [tenantId, parsed.data.channelId, parsed.data.name, parsed.data.interactiveType,
        JSON.stringify(parsed.data.definition), parsed.data.status, userId]
    );
    await client.query(
      `INSERT INTO activity_logs(tenant_id,user_id,type,title,metadata)
       VALUES($1,$2,'meta_interactive.created','Meta interactive message created',$3::jsonb)`,
      [tenantId, userId, JSON.stringify({ interactiveMessageId: inserted.rows[0].id })]
    );
    const result = await client.query(`${selectInteractive()} WHERE im.tenant_id=$1 AND im.id=$2`, [
      tenantId, inserted.rows[0].id
    ]);
    return result.rows[0];
  });
}

export async function updateInteractiveMessage({ tenantId, userId, messageId, input }) {
  const parsed = interactiveMessageSchema.safeParse(input);
  if (!parsed.success) throw invalidInput(parsed);
  return transaction(async (client) => {
    const locked = await client.query(
      "SELECT id FROM whatsapp_interactive_messages WHERE id=$1 AND tenant_id=$2 FOR UPDATE",
      [messageId, tenantId]
    );
    if (!locked.rows[0]) return null;
    await assertChannel(client, tenantId, parsed.data.channelId);
    await client.query(
      `UPDATE whatsapp_interactive_messages SET channel_id=$3,name=$4,interactive_type=$5,
       definition=$6::jsonb,status=$7,updated_at=now() WHERE id=$1 AND tenant_id=$2`,
      [messageId, tenantId, parsed.data.channelId, parsed.data.name, parsed.data.interactiveType,
        JSON.stringify(parsed.data.definition), parsed.data.status]
    );
    await client.query(
      `INSERT INTO activity_logs(tenant_id,user_id,type,title,metadata)
       VALUES($1,$2,'meta_interactive.updated','Meta interactive message updated',$3::jsonb)`,
      [tenantId, userId, JSON.stringify({ interactiveMessageId: messageId })]
    );
    const result = await client.query(`${selectInteractive()} WHERE im.tenant_id=$1 AND im.id=$2`, [
      tenantId, messageId
    ]);
    return result.rows[0];
  });
}

export function buildMetaInteractivePayload(interactiveType, definition, recipient) {
  const to = String(recipient).replace(/^\+/, "");
  if (interactiveType === "list") {
    return {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: definition.body },
        ...(definition.footer ? { footer: { text: definition.footer } } : {}),
        action: {
          button: definition.buttonText,
          sections: definition.sections.map((section) => ({
            title: section.title,
            rows: section.rows.map((row) => ({
              id: row.id,
              title: row.title,
              ...(row.description ? { description: row.description } : {})
            }))
          }))
        }
      }
    };
  }
  if (interactiveType === "reply_buttons") {
    return {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: definition.body },
        ...(definition.footer ? { footer: { text: definition.footer } } : {}),
        action: {
          buttons: definition.buttons.map((button) => ({
            type: "reply",
            reply: { id: button.id, title: button.title }
          }))
        }
      }
    };
  }
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "cta_url",
      body: { text: definition.body },
      ...(definition.footer ? { footer: { text: definition.footer } } : {}),
      action: {
        name: "cta_url",
        parameters: { display_text: definition.displayText, url: definition.url }
      }
    }
  };
}

function normalizeRecipient(value) {
  const parsed = parsePhoneNumberFromString(String(value || "").trim(), "SA");
  if (!parsed?.isValid()) {
    throw Object.assign(new Error("رقم المستلم غير صالح."), { code: "INVALID_RECIPIENT", status: 400 });
  }
  return parsed.number;
}

function graphConfiguration(channel) {
  const version = String(process.env.META_GRAPH_API_VERSION || "");
  if (!/^v\d+\.\d+$/.test(version) || !channel.phone_number_id || !channel.channel_token_encrypted) {
    throw Object.assign(new Error("ربط Meta Cloud API غير مكتمل حاليًا."), {
      code: "META_NOT_CONFIGURED",
      status: 503
    });
  }
  return {
    version,
    phoneNumberId: channel.phone_number_id,
    accessToken: decryptSecret(channel.channel_token_encrypted, process.env.ENCRYPTION_KEY)
  };
}

async function callMetaMessagesApi(config, payload) {
  const response = await fetch(
    `https://graph.facebook.com/${config.version}/${encodeURIComponent(config.phoneNumberId)}/messages`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${config.accessToken}`,
        "content-type": "application/json",
        accept: "application/json"
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000)
    }
  );
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result?.messages?.[0]?.id) {
    throw Object.assign(new Error(
      String(result?.error?.message || `Meta Messages API failed (${response.status})`).slice(0, 500)
    ), { code: "META_SEND_FAILED", status: 502 });
  }
  return result;
}

export async function sendMetaTextMessage({ channelId, to, text }) {
  const result = await query(
    `SELECT id,provider,status,phone_number_id,channel_token_encrypted
       FROM whatsapp_channels
      WHERE id=$1 AND provider IN ('meta','meta_cloud','meta_cloud_api') LIMIT 1`,
    [channelId]
  );
  const channel = result.rows[0];
  if (!channel || channel.status !== "connected") {
    throw Object.assign(new Error("قناة Meta الرسمية غير متصلة حاليًا."), { code: "META_NOT_CONNECTED", status: 409 });
  }
  const recipient = normalizeRecipient(to).replace(/^\+/, "");
  return callMetaMessagesApi(graphConfiguration(channel), {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipient,
    type: "text",
    text: { preview_url: false, body: String(text || "").trim() }
  });
}

export async function sendMetaImageMessage({ channelId, to, imageUrl, caption }) {
  const url = String(imageUrl || "").trim();
  if (!/^https:\/\//i.test(url)) {
    throw Object.assign(new Error("رابط صورة واتساب يجب أن يكون HTTPS عامًا."), {
      code: "META_IMAGE_URL_INVALID",
      status: 400
    });
  }
  const result = await query(
    `SELECT id,provider,status,phone_number_id,channel_token_encrypted
       FROM whatsapp_channels
      WHERE id=$1 AND provider IN ('meta','meta_cloud','meta_cloud_api') LIMIT 1`,
    [channelId]
  );
  const channel = result.rows[0];
  if (!channel || channel.status !== "connected") {
    throw Object.assign(new Error("قناة Meta الرسمية غير متصلة حاليًا."), { code: "META_NOT_CONNECTED", status: 409 });
  }
  return callMetaMessagesApi(graphConfiguration(channel), {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: normalizeRecipient(to).replace(/^\+/, ""),
    type: "image",
    image: { link: url, caption: String(caption || "").trim().slice(0, 1024) }
  });
}

export async function sendInteractiveMessage({
  tenantId, userId, messageId, recipient, idempotencyKey, isTest = false
}) {
  const normalizedRecipient = normalizeRecipient(recipient);
  const prepared = await transaction(async (client) => {
    const result = await client.query(
      `SELECT im.*,wc.provider,wc.status AS channel_status,wc.phone_number_id,
              wc.channel_token_encrypted
         FROM whatsapp_interactive_messages im
         JOIN whatsapp_channels wc ON wc.id=im.channel_id AND wc.tenant_id=im.tenant_id
        WHERE im.id=$1 AND im.tenant_id=$2 FOR UPDATE OF im`,
      [messageId, tenantId]
    );
    const row = result.rows[0];
    if (!row) return null;
    if (row.channel_status !== "connected") {
      throw Object.assign(new Error("قناة Meta غير متصلة حاليًا."), { status: 409 });
    }
    if (!isTest && row.status !== "active") {
      throw Object.assign(new Error("فعّل الرسالة التفاعلية قبل إرسالها."), { status: 409 });
    }
    const window = await client.query(
      `SELECT id FROM whatsapp_conversation_windows
        WHERE tenant_id=$1 AND channel_id=$2 AND recipient_e164=$3 AND expires_at>now() LIMIT 1`,
      [tenantId, row.channel_id, normalizedRecipient]
    );
    if (!window.rows[0]) {
      throw Object.assign(new Error(
        "لا يمكن إرسال الرسالة التفاعلية خارج سياق المحادثة المسموح. ابدأ بقالب واتساب معتمد."
      ), { code: "CONVERSATION_WINDOW_CLOSED", status: 409 });
    }
    const dedupe = crypto.createHash("sha256")
      .update(`${tenantId}|${messageId}|${normalizedRecipient}|${idempotencyKey || ""}|${isTest}`)
      .digest("hex");
    const duplicate = await client.query(
      `SELECT id,provider_message_id FROM message_queue
        WHERE tenant_id=$1 AND dedupe_hash=$2 AND status IN ('processing','sent') LIMIT 1`,
      [tenantId, dedupe]
    );
    if (duplicate.rows[0]) {
      return { duplicate: true, queueId: duplicate.rows[0].id, providerMessageId: duplicate.rows[0].provider_message_id };
    }
    const queued = await client.query(
      `INSERT INTO message_queue
        (tenant_id,whatsapp_channel_id,scheduled_for,status,attempts,max_attempts,
         channel_type,message_type,destination,message_body,reference_type,reference_id,
         dedupe_hash,safety_status,delay_seconds,is_billable,billing_status)
       VALUES($1,$2,now(),'processing',1,1,'whatsapp',$3,$4,$5,$6,$7,$8,'passed',0,$9,$10)
       RETURNING id`,
      [tenantId, row.channel_id, isTest ? "test_message" : "interactive_message",
        normalizedRecipient, JSON.stringify(row.definition), "interactive_message", row.id,
        dedupe, !isTest, isTest ? "not_billable" : "uncharged"]
    );
    return { row, queueId: queued.rows[0].id };
  });
  if (!prepared) return null;
  if (prepared.duplicate) return prepared;

  try {
    const config = graphConfiguration(prepared.row);
    const payload = buildMetaInteractivePayload(
      prepared.row.interactive_type, prepared.row.definition, normalizedRecipient
    );
    const sent = await callMetaMessagesApi(config, payload);
    const providerMessageId = sent.messages[0].id;
    await transaction(async (client) => {
      await client.query(
        `UPDATE message_queue SET status='sent',provider_message_id=$2,sent_at=now(),
         safety_status='passed',updated_at=now() WHERE id=$1 AND tenant_id=$3`,
        [prepared.queueId, providerMessageId, tenantId]
      );
      await client.query(
        `INSERT INTO whatsapp_usage_records
          (tenant_id,message_id,meta_message_id,usage_source,message_kind,status,accepted_at)
         VALUES($1,$2,$3,$4,$5,'accepted',now())
         ON CONFLICT (tenant_id,message_id) DO NOTHING`,
        [tenantId, prepared.queueId, providerMessageId,
          isTest ? "test_message" : "interactive_message", prepared.row.interactive_type]
      );
      await client.query(
        `INSERT INTO activity_logs(tenant_id,user_id,type,title,metadata)
         VALUES($1,$2,$3,'Meta interactive message accepted',$4::jsonb)`,
        [tenantId, userId, isTest ? "meta_interactive.test_accepted" : "meta_interactive.accepted",
          JSON.stringify({ interactiveMessageId: messageId, queueId: prepared.queueId })]
      );
    });
    return { queueId: prepared.queueId, providerMessageId, status: "accepted" };
  } catch (error) {
    await query(
      `UPDATE message_queue SET status='failed',last_error=$2,failed_at=now(),updated_at=now()
        WHERE id=$1 AND tenant_id=$3`,
      [prepared.queueId, String(error.message || "Meta send failed").slice(0, 500), tenantId]
    ).catch(() => null);
    throw error;
  }
}

function findStoredAction(definition, optionId) {
  for (const section of definition?.sections || []) {
    const row = (section.rows || []).find((item) => item.id === optionId);
    if (row) return row;
  }
  return (definition?.buttons || []).find((item) => item.id === optionId) || null;
}

export async function applyMetaMessagesWebhook({ wabaId, phoneNumberId, value }) {
  const channel = await query(
    `SELECT id,tenant_id FROM whatsapp_channels
      WHERE provider IN ('meta','meta_cloud_api')
        AND (($1::text<>'' AND waba_id=$1) OR ($2::text<>'' AND phone_number_id=$2))
      LIMIT 1`,
    [String(wabaId || ""), String(phoneNumberId || "")]
  );
  if (!channel.rows[0]) return { processed: 0 };
  const { id: channelId, tenant_id: tenantId } = channel.rows[0];
  let processed = 0;
  for (const message of Array.isArray(value?.messages) ? value.messages : []) {
    const sender = normalizeRecipient(message.from);
    const inboundAt = new Date(Number(message.timestamp || 0) * 1000 || Date.now());
    await query(
      `INSERT INTO whatsapp_conversation_windows
        (tenant_id,channel_id,recipient_e164,last_inbound_at,expires_at)
       VALUES($1,$2,$3,$4,$4 + interval '24 hours')
       ON CONFLICT(tenant_id,channel_id,recipient_e164) DO UPDATE SET
       last_inbound_at=EXCLUDED.last_inbound_at,expires_at=EXCLUDED.expires_at,updated_at=now()`,
      [tenantId, channelId, sender, inboundAt]
    );
    const reply = message.interactive?.list_reply || message.interactive?.button_reply || null;
    if (reply?.id) {
      const definitions = await query(
        `SELECT id,definition FROM whatsapp_interactive_messages
          WHERE tenant_id=$1 AND channel_id=$2 AND status='active'`,
        [tenantId, channelId]
      );
      const matched = definitions.rows
        .map((item) => ({ ...item, action: findStoredAction(item.definition, reply.id) }))
        .find((item) => item.action);
      if (matched) {
        await query(
          `INSERT INTO whatsapp_interactive_replies
            (tenant_id,interactive_message_id,meta_message_id,sender_e164,option_id,payload)
           VALUES($1,$2,$3,$4,$5,$6::jsonb)`,
          [tenantId, matched.id, message.id || null, sender, reply.id,
            JSON.stringify({ title: reply.title || null, action: matched.action })]
        );
      }
    }
    processed += 1;
  }
  for (const status of Array.isArray(value?.statuses) ? value.statuses : []) {
    const normalized = String(status.status || "").toLowerCase();
    if (!["sent", "delivered", "read", "failed"].includes(normalized)) continue;
    await query(
      `UPDATE whatsapp_usage_records SET status=$3,
       delivered_at=CASE WHEN $3='delivered' THEN now() ELSE delivered_at END,
       read_at=CASE WHEN $3='read' THEN now() ELSE read_at END,
       failed_at=CASE WHEN $3='failed' THEN now() ELSE failed_at END,
       updated_at=now()
       WHERE tenant_id=$1 AND meta_message_id=$2`,
      [tenantId, status.id, normalized]
    );
    processed += 1;
  }
  return { processed };
}
