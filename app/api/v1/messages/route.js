import { authenticateCustomApi, customApiError, publishCustomEvent, withIdempotency } from "../../../../src/server/custom-integrations.js";
import { transaction } from "../../../../src/server/db.js";
import { enqueueMessage } from "../../../../src/server/message-queue.js";
import { renderTemplate } from "../../../../src/lib/templateRendering.js";

export async function POST(req) {
  const auth = await authenticateCustomApi(req, "messages:send");
  if (!auth.ok) return customApiError(auth);
  const body = await req.json().catch(() => ({}));
  const channel = String(body.channel || "").toLowerCase();
  if (!["whatsapp", "email"].includes(channel) || !body.customer_id || !body.template_id) {
    return customApiError({ ...auth, code: "validation_error", status: 400 });
  }

  return withIdempotency({
    req,
    auth,
    routeKey: "POST:/api/v1/messages",
    body,
    execute: async () => {
      const related = await transaction(async (client) => {
        const result = await client.query(
          `SELECT c.id AS "customerId", c.name AS "customerName", c.email, c.phone,
                  c.whatsapp_number AS "whatsappNumber",
                  t.id AS "templateId", t.body, t.title,
                  wc.id AS "whatsappChannelId"
             FROM customers c
             JOIN notification_templates t
               ON t.id=$3 AND t.tenant_id=$1 AND t.is_active=true AND lower(t.channel)=$4
             LEFT JOIN LATERAL (
               SELECT id FROM whatsapp_channels
                WHERE tenant_id=$1 AND status='connected'
                ORDER BY connected_at DESC NULLS LAST LIMIT 1
             ) wc ON true
            WHERE c.id=$2 AND c.tenant_id=$1 LIMIT 1`,
          [auth.tenantId, body.customer_id, body.template_id, channel]
        );
        return result.rows[0] || null;
      });

      if (!related) {
        return {
          status: 404,
          body: { error: { code: "resource_not_found", message: "العميل أو القالب غير موجود.", request_id: auth.requestId } }
        };
      }
      if (channel === "whatsapp" && !related.whatsappChannelId) {
        return {
          status: 409,
          body: { error: { code: "channel_not_connected", message: "قناة واتساب غير متصلة.", request_id: auth.requestId } }
        };
      }

      let renderedBody;
      let renderedSubject = null;
      try {
        const variables = {
          ...(body.variables && typeof body.variables === "object" ? body.variables : {}),
          customer_name: related.customerName,
          customer_email: related.email,
          customer_phone: related.whatsappNumber || related.phone
        };
        renderedBody = renderTemplate(related.body, variables);
        renderedSubject = related.title ? renderTemplate(related.title, variables) : null;
      } catch (error) {
        return {
          status: 422,
          body: {
            error: {
              code: "template_render_failed",
              message: "تعذر تجهيز القالب بسبب متغيرات ناقصة.",
              details: String(error.message || error),
              request_id: auth.requestId
            }
          }
        };
      }

      const queued = await enqueueMessage({
        tenantId: auth.tenantId,
        customerId: related.customerId,
        whatsappChannelId: channel === "whatsapp" ? related.whatsappChannelId : null,
        templateId: related.templateId,
        channelType: channel,
        messageType: "custom_api",
        destination: channel === "whatsapp" ? (related.whatsappNumber || related.phone) : related.email,
        emailTo: channel === "email" ? related.email : null,
        subject: channel === "email" ? renderedSubject : null,
        messageBody: renderedBody,
        referenceType: "custom_api_request",
        referenceId: auth.requestId,
        triggerKey: `custom_api:${auth.integrationId}:${auth.requestId}`,
        sourceMode: "manual",
        enforceConnected: channel === "whatsapp"
      });

      if (!queued.ok) {
        return {
          status: queued.reason === "duplicate_message" ? 409 : 422,
          body: {
            error: {
              code: queued.reason,
              message: "لم تُقبل الرسالة في طابور الإرسال.",
              request_id: auth.requestId
            }
          }
        };
      }

      const item = await transaction(async (client) => {
        const row = {
          id: queued.queueId,
          status: "queued",
          scheduledAt: queued.scheduledFor
        };
        await publishCustomEvent(client, {
          tenantId: auth.tenantId,
          integrationId: auth.integrationId,
          type: "message.queued",
          resourceType: "message",
          resourceId: row.id,
          object: { id: row.id, status: row.status, channel, scheduled_at: row.scheduledAt }
        });
        return row;
      });

      return { status: 202, body: { data: item, request_id: auth.requestId } };
    }
  });
}
