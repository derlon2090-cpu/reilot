import { z } from "zod";
import { requireSession } from "../../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../../src/server/campaign-contacts.js";
import { transaction } from "../../../../../src/server/db.js";
import { enforceActivityRateLimit } from "../../../../../src/server/campaign-contacts.js";
import {
  createMoyasarTopupInvoice,
  WHATSAPP_TOPUP_AMOUNTS
} from "../../../../../src/server/moyasar-billing.js";

const topupSchema = z.object({
  amount: z.coerce.number().refine((value) => WHATSAPP_TOPUP_AMOUNTS.includes(value), {
    message: "unsupported_topup_amount"
  })
});

export async function POST(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) {
    return Response.json({ ok: false, reason: "invalid_origin" }, { status: 403 });
  }
  const parsed = topupSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ ok: false, reason: "invalid_amount", issues: parsed.error.issues }, { status: 400 });
  }
  const allowed = await transaction(async (client) => enforceActivityRateLimit(client, {
    tenantId: auth.session.tenantId,
    userId: auth.session.userId,
    action: "billing.whatsapp.topup.requested",
    limit: 5,
    interval: "10 minutes"
  }));
  if (!allowed) return Response.json({ ok: false, reason: "rate_limited" }, { status: 429 });

  try {
    const payment = await createMoyasarTopupInvoice({
      tenantId: auth.session.tenantId,
      userId: auth.session.userId,
      amount: parsed.data.amount,
      requestUrl: request.url
    });
    await transaction(async (client) => {
      await client.query(
        `INSERT INTO activity_logs (tenant_id,user_id,type,title,metadata)
         VALUES ($1,$2,'billing.whatsapp.topup.requested',
           'WhatsApp wallet top-up requested',$3::jsonb)`,
        [auth.session.tenantId, auth.session.userId, JSON.stringify({
          paymentId: payment.paymentId,
          providerInvoiceId: payment.providerInvoiceId,
          amount: parsed.data.amount,
          currency: "SAR"
        })]
      );
    });
    return Response.json({ ok: true, ...payment });
  } catch (error) {
    return Response.json({
      ok: false,
      code: error.code || "PAYMENT_PROVIDER_ERROR",
      message: error.message || "تعذر إنشاء طلب الدفع. لم تتم إضافة أي رصيد."
    }, { status: Number(error.status || 500) });
  }
}
