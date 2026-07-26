import { transaction } from "../../server/db.js";

function money(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(4)) : 0;
}
export function walletHealth(wallet) {
  const available = money(wallet?.available_balance ?? wallet?.availableBalance);
  const threshold = money(wallet?.low_balance_threshold ?? wallet?.lowBalanceThreshold ?? 10);
  if (available <= 0) return "insufficient";
  if (available <= Math.max(1, threshold / 2)) return "critical";
  if (available <= threshold) return "low";
  return "good";
}

export async function ensureWhatsappWalletWithClient(client, tenantId) {
  const result = await client.query(
    `INSERT INTO whatsapp_wallets (tenant_id)
     VALUES ($1)
     ON CONFLICT (tenant_id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id
     RETURNING *`,
    [tenantId]
  );
  return result.rows[0];
}

async function lockedWallet(client, tenantId) {
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`whatsapp-wallet:${tenantId}`]);
  await ensureWhatsappWalletWithClient(client, tenantId);
  const result = await client.query(
    "SELECT * FROM whatsapp_wallets WHERE tenant_id = $1 FOR UPDATE",
    [tenantId]
  );
  return result.rows[0];
}

async function existingTransaction(client, idempotencyKey) {
  const result = await client.query(
    "SELECT * FROM whatsapp_wallet_transactions WHERE idempotency_key = $1 LIMIT 1",
    [idempotencyKey]
  );
  return result.rows[0] || null;
}

export async function applySuccessfulTopupWithClient(client, {
  tenantId,
  amount,
  paymentId,
  idempotencyKey = `wallet-topup:${paymentId}`
}) {
  const normalized = money(amount);
  if (!(normalized > 0)) throw new Error("Top-up amount must be positive");
  const duplicate = await existingTransaction(client, idempotencyKey);
  if (duplicate) return { changed: false, transaction: duplicate };
  const wallet = await lockedWallet(client, tenantId);
  const before = money(wallet.available_balance);
  const after = money(before + normalized);
  const updated = await client.query(
    `UPDATE whatsapp_wallets
        SET available_balance = $2,
            total_charged = total_charged + $3,
            updated_at = now()
      WHERE id = $1 RETURNING *`,
    [wallet.id, after, normalized]
  );
  const inserted = await client.query(
    `INSERT INTO whatsapp_wallet_transactions (
       tenant_id, wallet_id, transaction_type, amount, currency,
       balance_before, balance_after, reference_type, reference_id,
       idempotency_key, status, description
     ) VALUES ($1,$2,'top_up',$3,$4,$5,$6,'payment',$7,$8,'completed','شحن رصيد واتساب')
     RETURNING *`,
    [tenantId, wallet.id, normalized, wallet.currency, before, after, paymentId, idempotencyKey]
  );
  return { changed: true, wallet: updated.rows[0], transaction: inserted.rows[0] };
}

export async function reserveWhatsappBalanceWithClient(client, {
  tenantId,
  amount,
  referenceType,
  referenceId,
  idempotencyKey
}) {
  const normalized = money(amount);
  if (!(normalized > 0)) throw new Error("Reservation amount must be positive");
  const duplicate = await existingTransaction(client, idempotencyKey);
  if (duplicate) return { changed: false, transaction: duplicate };
  const wallet = await lockedWallet(client, tenantId);
  const before = money(wallet.available_balance);
  if (before < normalized) {
    const error = new Error("رصيد واتساب غير كافٍ.");
    error.code = "WHATSAPP_WALLET_INSUFFICIENT";
    error.status = 409;
    throw error;
  }
  const after = money(before - normalized);
  const updated = await client.query(
    `UPDATE whatsapp_wallets
        SET available_balance = $2,
            reserved_balance = reserved_balance + $3,
            updated_at = now()
      WHERE id = $1 RETURNING *`,
    [wallet.id, after, normalized]
  );
  const inserted = await client.query(
    `INSERT INTO whatsapp_wallet_transactions (
       tenant_id, wallet_id, transaction_type, amount, currency,
       balance_before, balance_after, reference_type, reference_id,
       idempotency_key, status, description
     ) VALUES ($1,$2,'reservation',$3,$4,$5,$6,$7,$8,$9,'completed','حجز مؤقت لإرسال واتساب')
     RETURNING *`,
    [tenantId, wallet.id, normalized, wallet.currency, before, after,
      referenceType || null, referenceId || null, idempotencyKey]
  );
  return { changed: true, wallet: updated.rows[0], transaction: inserted.rows[0] };
}

export async function releaseWhatsappReservationWithClient(client, {
  tenantId,
  amount,
  referenceType,
  referenceId,
  idempotencyKey
}) {
  const normalized = money(amount);
  if (!(normalized > 0)) throw new Error("Release amount must be positive");
  const duplicate = await existingTransaction(client, idempotencyKey);
  if (duplicate) return { changed: false, transaction: duplicate };
  const wallet = await lockedWallet(client, tenantId);
  const released = Math.min(normalized, money(wallet.reserved_balance));
  if (!(released > 0)) return { changed: false, wallet };
  const before = money(wallet.available_balance);
  const after = money(before + released);
  const updated = await client.query(
    `UPDATE whatsapp_wallets
        SET available_balance = $2,
            reserved_balance = GREATEST(0, reserved_balance - $3),
            updated_at = now()
      WHERE id = $1 RETURNING *`,
    [wallet.id, after, released]
  );
  const inserted = await client.query(
    `INSERT INTO whatsapp_wallet_transactions (
       tenant_id, wallet_id, transaction_type, amount, currency,
       balance_before, balance_after, reference_type, reference_id,
       idempotency_key, status, description
     ) VALUES ($1,$2,'reservation_release',$3,$4,$5,$6,$7,$8,$9,'completed','إلغاء حجز رسالة واتساب')
     RETURNING *`,
    [tenantId, wallet.id, released, wallet.currency, before, after,
      referenceType || null, referenceId || null, idempotencyKey]
  );
  return { changed: true, wallet: updated.rows[0], transaction: inserted.rows[0] };
}

export async function finalizeWhatsappChargeWithClient(client, {
  tenantId,
  amount,
  referenceType,
  referenceId,
  idempotencyKey,
  reservationAmount = 0
}) {
  const normalized = money(amount);
  if (!(normalized > 0)) throw new Error("Charge amount must be positive");
  const duplicate = await existingTransaction(client, idempotencyKey);
  if (duplicate) return { changed: false, transaction: duplicate };
  const wallet = await lockedWallet(client, tenantId);
  const reserved = Math.min(money(reservationAmount), money(wallet.reserved_balance));
  const uncovered = money(normalized - reserved);
  const before = money(wallet.available_balance);
  if (before < uncovered) {
    const error = new Error("رصيد واتساب غير كافٍ لإتمام الخصم.");
    error.code = "WHATSAPP_WALLET_INSUFFICIENT";
    error.status = 409;
    throw error;
  }
  const after = money(before - uncovered);
  const updated = await client.query(
    `UPDATE whatsapp_wallets
        SET available_balance = $2,
            reserved_balance = GREATEST(0, reserved_balance - $3),
            total_spent = total_spent + $4,
            updated_at = now()
      WHERE id = $1 RETURNING *`,
    [wallet.id, after, reserved, normalized]
  );
  const inserted = await client.query(
    `INSERT INTO whatsapp_wallet_transactions (
       tenant_id, wallet_id, transaction_type, amount, currency,
       balance_before, balance_after, reference_type, reference_id,
       idempotency_key, status, description
     ) VALUES ($1,$2,'message_charge',$3,$4,$5,$6,$7,$8,$9,'completed','خصم رسالة واتساب قابلة للفوترة')
     RETURNING *`,
    [tenantId, wallet.id, normalized, wallet.currency, before, after,
      referenceType || null, referenceId || null, idempotencyKey]
  );
  return { changed: true, wallet: updated.rows[0], transaction: inserted.rows[0] };
}

export function applySuccessfulTopup(input) {
  return transaction((client) => applySuccessfulTopupWithClient(client, input));
}
