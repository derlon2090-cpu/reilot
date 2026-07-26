import { randomUUID, timingSafeEqual } from "node:crypto";
import { query, transaction } from "./db.js";
import {
  applySuccessfulTopupWithClient,
  ensureWhatsappWalletWithClient
} from "../lib/billing/whatsapp-wallet.js";

export const WHATSAPP_TOPUP_AMOUNTS = Object.freeze([50, 100, 250, 500, 1000]);

function providerBaseUrl() {
  return String(process.env.MOYASAR_API_BASE_URL || "https://api.moyasar.com/v1").replace(/\/+$/, "");
}

function secretKey() {
  const value = process.env.MOYASAR_SECRET_KEY?.trim();
  if (!value) {
    const error = new Error("الدفع الإلكتروني غير مفعّل حاليًا. لم تتم إضافة أي رصيد.");
    error.code = "PAYMENT_PROVIDER_NOT_CONFIGURED";
    error.status = 503;
    throw error;
  }
  return value;
}

function basicAuthorization() {
  return `Basic ${Buffer.from(`${secretKey()}:`, "utf8").toString("base64")}`;
}

function applicationOrigin(requestUrl) {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const origin = configured || new URL(requestUrl).origin;
  const parsed = new URL(origin);
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    const error = new Error("رابط المنصة الآمن NEXT_PUBLIC_APP_URL غير مضبوط.");
    error.code = "PAYMENT_CALLBACK_URL_INVALID";
    error.status = 503;
    throw error;
  }
  return parsed.origin;
}

async function providerRequest(path, options = {}) {
  const response = await fetch(`${providerBaseUrl()}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      Authorization: basicAuthorization(),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(15_000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || "تعذر الاتصال بمزود الدفع.");
    error.code = "PAYMENT_PROVIDER_ERROR";
    error.status = response.status >= 500 ? 502 : 400;
    throw error;
  }
  return payload;
}

export function secureWebhookTokenMatches(received, expected = process.env.MOYASAR_WEBHOOK_SECRET) {
  const left = Buffer.from(String(received || ""), "utf8");
  const right = Buffer.from(String(expected || ""), "utf8");
  return left.length > 0 && left.length === right.length && timingSafeEqual(left, right);
}

export function normalizeMoyasarWebhook(payload) {
  const type = String(payload?.type || "");
  const data = payload?.data && typeof payload.data === "object" ? payload.data : {};
  return {
    type,
    secretToken: payload?.secret_token,
    paymentId: data.id ? String(data.id) : null,
    invoiceId: data.invoice_id ? String(data.invoice_id) : null,
    status: String(data.status || "").toLowerCase()
  };
}

export async function createMoyasarTopupInvoice({ tenantId, userId, amount, requestUrl }) {
  const normalizedAmount = Number(amount);
  if (!WHATSAPP_TOPUP_AMOUNTS.includes(normalizedAmount)) {
    const error = new Error("مبلغ الشحن غير معتمد.");
    error.code = "INVALID_TOPUP_AMOUNT";
    error.status = 400;
    throw error;
  }
  const topupId = randomUUID();
  const origin = applicationOrigin(requestUrl);
  await transaction(async (client) => {
    const wallet = await ensureWhatsappWalletWithClient(client, tenantId);
    await client.query(
      `INSERT INTO whatsapp_topup_payments (
         id,tenant_id,user_id,wallet_id,amount,currency,status,idempotency_key
       ) VALUES ($1,$2,$3,$4,$5,'SAR','creating',$6)`,
      [topupId, tenantId, userId, wallet.id, normalizedAmount, `topup-request:${topupId}`]
    );
  });

  try {
    const invoice = await providerRequest("/invoices", {
      method: "POST",
      body: JSON.stringify({
        amount: Math.round(normalizedAmount * 100),
        currency: "SAR",
        description: `Renvix WhatsApp wallet top-up - ${normalizedAmount} SAR`,
        success_url: `${origin}/dashboard/billing?topup=success`,
        back_url: `${origin}/dashboard/billing?topup=cancelled`,
        expired_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        metadata: {
          renvix_topup_id: topupId,
          tenant_id: tenantId
        }
      })
    });
    if (!invoice.id || !invoice.url || invoice.status !== "initiated") {
      throw Object.assign(new Error("استجابة إنشاء فاتورة الدفع غير مكتملة."), {
        code: "PAYMENT_PROVIDER_INVALID_RESPONSE",
        status: 502
      });
    }
    await query(
      `UPDATE whatsapp_topup_payments SET
         provider_invoice_id=$2,checkout_url=$3,status='initiated',
         provider_payload=$4::jsonb,updated_at=now()
       WHERE id=$1`,
      [topupId, String(invoice.id), String(invoice.url), JSON.stringify(invoice)]
    );
    return {
      paymentId: topupId,
      providerInvoiceId: String(invoice.id),
      checkoutUrl: String(invoice.url)
    };
  } catch (error) {
    await query(
      `UPDATE whatsapp_topup_payments
          SET status='failed',failed_at=now(),
              provider_payload=$2::jsonb,updated_at=now()
        WHERE id=$1`,
      [topupId, JSON.stringify({ code: error.code || "PAYMENT_PROVIDER_ERROR" })]
    );
    throw error;
  }
}

async function fetchProviderInvoice(invoiceId) {
  return providerRequest(`/invoices/${encodeURIComponent(invoiceId)}`, { method: "GET" });
}

export async function processMoyasarWebhook(payload) {
  const event = normalizeMoyasarWebhook(payload);
  if (!secureWebhookTokenMatches(event.secretToken)) {
    const error = new Error("Invalid Moyasar webhook secret");
    error.code = "INVALID_WEBHOOK_SECRET";
    error.status = 401;
    throw error;
  }
  if (!event.invoiceId || !event.type.startsWith("payment_")) {
    return { changed: false, ignored: "unsupported_event" };
  }
  const local = await query(
    `SELECT * FROM whatsapp_topup_payments
      WHERE provider='moyasar' AND provider_invoice_id=$1 LIMIT 1`,
    [event.invoiceId]
  );
  if (!local.rows[0]) return { changed: false, ignored: "unknown_invoice" };
  if (event.type !== "payment_paid" || event.status !== "paid") {
    if (["payment_failed", "payment_voided", "payment_refunded"].includes(event.type)) {
      const next = event.type === "payment_refunded" ? "refunded"
        : event.type === "payment_voided" ? "canceled" : "failed";
      await query(
        `UPDATE whatsapp_topup_payments SET status=$2,
           failed_at=CASE WHEN $2='failed' THEN now() ELSE failed_at END,
           provider_payment_id=COALESCE($3,provider_payment_id),
           provider_payload=$4::jsonb,updated_at=now()
         WHERE id=$1 AND status <> 'paid'`,
        [local.rows[0].id, next, event.paymentId, JSON.stringify(payload)]
      );
    }
    return { changed: false, ignored: "payment_not_paid" };
  }

  const invoice = await fetchProviderInvoice(event.invoiceId);
  const expectedHalalas = Math.round(Number(local.rows[0].amount) * 100);
  if (invoice.status !== "paid"
      || Number(invoice.amount) !== expectedHalalas
      || String(invoice.currency).toUpperCase() !== String(local.rows[0].currency).toUpperCase()) {
    const error = new Error("Moyasar invoice verification failed");
    error.code = "PAYMENT_VERIFICATION_FAILED";
    error.status = 409;
    throw error;
  }

  return transaction(async (client) => {
    const locked = await client.query(
      "SELECT * FROM whatsapp_topup_payments WHERE id=$1 FOR UPDATE",
      [local.rows[0].id]
    );
    const topup = locked.rows[0];
    if (!topup || topup.status === "paid") return { changed: false, duplicate: true };
    await applySuccessfulTopupWithClient(client, {
      tenantId: topup.tenant_id,
      amount: Number(topup.amount),
      paymentId: event.invoiceId,
      idempotencyKey: `wallet-topup:${event.invoiceId}`
    });
    await client.query(
      `UPDATE whatsapp_topup_payments SET status='paid',paid_at=now(),
         provider_payment_id=$2,provider_payload=$3::jsonb,updated_at=now()
       WHERE id=$1`,
      [topup.id, event.paymentId, JSON.stringify(invoice)]
    );
    const invoiceNumber = `WA-${String(event.invoiceId).replaceAll("-", "").slice(0, 12).toUpperCase()}`;
    await client.query(
      `INSERT INTO billing_invoices (
         tenant_id,invoice_number,invoice_type,provider,provider_invoice_id,
         amount,currency,status,description,paid_at,metadata
       ) VALUES ($1,$2,'whatsapp_topup','moyasar',$3,$4,$5,'paid',
         'شحن رصيد واتساب',now(),$6::jsonb)
       ON CONFLICT (provider_invoice_id) DO NOTHING`,
      [topup.tenant_id, invoiceNumber, event.invoiceId, topup.amount, topup.currency,
        JSON.stringify({ topupId: topup.id, providerPaymentId: event.paymentId })]
    );
    await client.query(
      `INSERT INTO in_app_notifications (
         tenant_id,user_id,type,title,message,entity_type,entity_id,priority,
         action_url,metadata,dedupe_key
       ) VALUES ($1,$2,'whatsapp_topup_paid','تم شحن رصيد واتساب بنجاح',
         $3,'whatsapp_wallet',$4,'normal','/dashboard/billing',$5::jsonb,$6)
       ON CONFLICT (tenant_id,dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING`,
      [topup.tenant_id, topup.user_id,
        `تمت إضافة ${Number(topup.amount).toFixed(2)} ر.س إلى محفظة واتساب.`,
        topup.wallet_id, JSON.stringify({ invoiceId: event.invoiceId, amount: topup.amount }),
        `whatsapp-topup:${event.invoiceId}`]
    );
    return { changed: true, tenantId: topup.tenant_id, topupId: topup.id };
  });
}
