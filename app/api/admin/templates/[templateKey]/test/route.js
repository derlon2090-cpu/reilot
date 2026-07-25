import { z } from "zod";
import { auditAdmin, requireAdminPermission } from "../../../../../../src/server/admin-auth.js";
import { query } from "../../../../../../src/server/db.js";
import { sendAdminTemplateTest } from "../../../../../../src/server/admin-template-events.js";

const inputSchema = z.object({
  recipient: z.string().trim().min(5).max(320),
  values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({})
});

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validPhone(value) {
  return /^\+?[1-9]\d{7,14}$/.test(value.replace(/[\s()-]/g, ""));
}

function safeReason(error) {
  const known = new Set([
    "ADMIN_TEMPLATE_NOT_FOUND",
    "ADMIN_TEMPLATE_DISABLED",
    "ADMIN_EVOLUTION_CHANNEL_MISSING",
    "VARIABLE_NOT_ALLOWED",
    "REQUIRED_VARIABLE_MISSING",
    "REQUIRED_VALUE_MISSING"
  ]);
  return known.has(error?.code) ? error.code : "admin_template_test_failed";
}

export async function POST(request, { params }) {
  const auth = await requireAdminPermission(request, "templates", "update");
  if (!auth.ok) return auth.response;

  const { templateKey } = await params;
  const parsed = inputSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json(
      { ok: false, reason: "validation_error", errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const templateResult = await query(
    `SELECT channel FROM admin_message_templates WHERE template_key=$1 LIMIT 1`,
    [templateKey]
  );
  const template = templateResult.rows[0];
  if (!template) return Response.json({ ok: false, reason: "template_not_found" }, { status: 404 });

  const recipient = template.channel === "email"
    ? parsed.data.recipient.toLowerCase()
    : parsed.data.recipient.replace(/[\s()-]/g, "");
  const recipientValid = template.channel === "email" ? validEmail(recipient) : validPhone(recipient);
  if (!recipientValid) {
    return Response.json(
      { ok: false, reason: template.channel === "email" ? "invalid_email" : "invalid_phone" },
      { status: 400 }
    );
  }

  try {
    const result = await sendAdminTemplateTest({
      templateKey,
      recipient,
      values: parsed.data.values,
      adminUserId: auth.admin.adminId
    });
    await auditAdmin(request, {
      admin: auth.admin,
      action: "admin.template.test.accepted",
      resource: templateKey,
      metadata: { outboundId: result.outboundId, providerStatus: result.status }
    });
    return Response.json(
      {
        ok: true,
        outboundId: result.outboundId,
        status: result.status,
        message: "قَبِل مزود الإرسال رسالة الاختبار، وسيُحدَّث سجل التسليم من Webhook المزود."
      },
      { status: 202, headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  } catch (error) {
    const reason = safeReason(error);
    await auditAdmin(request, {
      admin: auth.admin,
      action: "admin.template.test.failed",
      resource: templateKey,
      status: "failed",
      metadata: { reason }
    });
    return Response.json(
      {
        ok: false,
        reason,
        variables: Array.isArray(error?.variables) ? error.variables : undefined
      },
      { status: reason === "ADMIN_TEMPLATE_DISABLED" ? 409 : 502 }
    );
  }
}
