import crypto from "node:crypto";
import { z } from "zod";
import { auditAdmin, requireAdminPermission } from "../../../../../../src/server/admin-auth.js";
import { transaction } from "../../../../../../src/server/db.js";
import { safeErrorMessage } from "../../../../../../src/server/security.js";

const inputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add_credit"),
    amount: z.number().finite().min(1).max(100000),
    note: z.string().trim().max(240).optional().default("")
  }),
  z.object({
    action: z.literal("change_plan"),
    planId: z.string().uuid()
  }),
  z.object({
    action: z.literal("remove_customer"),
    confirmation: z.string().trim().min(1).max(200)
  })
]);

function actionError(code, status = 409) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}

async function addCredit(client, tenant, input, admin) {
  await client.query(
    `INSERT INTO whatsapp_wallets (tenant_id,currency)
     VALUES ($1,'SAR') ON CONFLICT (tenant_id) DO NOTHING`,
    [tenant.id]
  );
  const walletResult = await client.query(
    `SELECT id,available_balance AS "availableBalance"
       FROM whatsapp_wallets WHERE tenant_id=$1 FOR UPDATE`,
    [tenant.id]
  );
  const wallet = walletResult.rows[0];
  if (!wallet) throw actionError("wallet_unavailable", 503);
  const before = Number(wallet.availableBalance || 0);
  const after = Number((before + input.amount).toFixed(4));
  await client.query(
    `UPDATE whatsapp_wallets
        SET available_balance=$2,total_charged=total_charged+$3,updated_at=now()
      WHERE id=$1`,
    [wallet.id, after, input.amount]
  );
  const transactionResult = await client.query(
    `INSERT INTO whatsapp_wallet_transactions
       (tenant_id,wallet_id,transaction_type,amount,currency,balance_before,balance_after,
        reference_type,reference_id,idempotency_key,status,description)
     VALUES ($1,$2,'admin_adjustment',$3,'SAR',$4,$5,'admin_user',$6,$7,'completed',$8)
     RETURNING id`,
    [tenant.id, wallet.id, input.amount, before, after, String(admin.adminId),
      `admin-credit:${tenant.id}:${crypto.randomUUID()}`,
      input.note || "إضافة رصيد بواسطة إدارة Renvix"]
  );
  return { balance: after, transactionId: transactionResult.rows[0]?.id || null };
}

async function changePlan(client, tenant, input) {
  const planResult = await client.query(
    `SELECT id,name,slug FROM platform_plans WHERE id=$1 AND is_active=true LIMIT 1`,
    [input.planId]
  );
  const plan = planResult.rows[0];
  if (!plan) throw actionError("plan_not_found", 404);
  const subscriptionResult = await client.query(
    `SELECT id,plan_id AS "planId" FROM platform_subscriptions
      WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
    [tenant.id]
  );
  const subscription = subscriptionResult.rows[0];
  if (!subscription) throw actionError("subscription_not_found", 404);
  await client.query(
    `UPDATE platform_subscriptions
        SET plan_id=$2,status=CASE WHEN status IN ('cancelled','expired') THEN 'active' ELSE status END,
            updated_at=now()
      WHERE id=$1`,
    [subscription.id, plan.id]
  );
  return { plan, previousPlanId: subscription.planId, subscriptionId: subscription.id };
}

async function removeCustomer(client, tenant, input) {
  if (input.confirmation !== tenant.name) throw actionError("confirmation_mismatch", 400);
  if (tenant.status === "disabled") throw actionError("customer_already_removed");
  const adminTenant = await client.query(
    `SELECT 1 FROM admin_users au JOIN users u ON u.id=au.user_id
      WHERE u.tenant_id=$1 AND au.status='active' LIMIT 1`,
    [tenant.id]
  );
  if (adminTenant.rows[0]) throw actionError("admin_tenant_cannot_be_removed", 403);
  await client.query("UPDATE tenants SET status='disabled',updated_at=now() WHERE id=$1", [tenant.id]);
  await client.query(
    `UPDATE platform_subscriptions SET status='cancelled',updated_at=now()
      WHERE tenant_id=$1 AND status <> 'cancelled'`,
    [tenant.id]
  );
  const sessions = await client.query(
    `UPDATE sessions SET expires_at=now(),updated_at=now()
      WHERE user_id IN (SELECT id FROM users WHERE tenant_id=$1) AND expires_at>now()
      RETURNING id`,
    [tenant.id]
  );
  return { disabledSessions: sessions.rowCount || 0 };
}

export async function POST(request, { params }) {
  const auth = await requireAdminPermission(request, "subscriptions", "update");
  if (!auth.ok) return auth.response;
  const { tenantId } = await params;
  const parsed = inputSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ ok: false, reason: "validation_error", errors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const result = await transaction(async (client) => {
      const tenantResult = await client.query(
        `SELECT id,name,status FROM tenants WHERE id=$1 LIMIT 1 FOR UPDATE`,
        [tenantId]
      );
      const tenant = tenantResult.rows[0];
      if (!tenant) throw actionError("customer_not_found", 404);
      if (tenant.status === "disabled" && parsed.data.action !== "remove_customer") {
        throw actionError("customer_removed");
      }
      if (parsed.data.action === "add_credit") return { tenant, action: parsed.data.action, ...(await addCredit(client, tenant, parsed.data, auth.admin)) };
      if (parsed.data.action === "change_plan") return { tenant, action: parsed.data.action, ...(await changePlan(client, tenant, parsed.data)) };
      return { tenant, action: parsed.data.action, ...(await removeCustomer(client, tenant, parsed.data)) };
    });

    await auditAdmin(request, {
      admin: auth.admin,
      action: `admin.customer.${result.action}`,
      resource: tenantId,
      metadata: result.action === "add_credit"
        ? { amount: parsed.data.amount, balance: result.balance, transactionId: result.transactionId }
        : result.action === "change_plan"
          ? { previousPlanId: result.previousPlanId, planId: result.plan.id, subscriptionId: result.subscriptionId }
          : { disabledSessions: result.disabledSessions }
    });

    const message = result.action === "add_credit"
      ? `تمت إضافة ${Number(parsed.data.amount).toLocaleString("en-US")} ر.س إلى رصيد العميل.`
      : result.action === "change_plan"
        ? `تم تغيير باقة العميل إلى ${result.plan?.name || "الباقة المحددة"}.`
        : "تمت إزالة العميل من القوائم النشطة وتعطيل جلساته دون حذف سجلاته.";
    return Response.json({ ok: true, action: result.action, result, message }, {
      headers: { "Cache-Control": "private, no-store, max-age=0" }
    });
  } catch (error) {
    const reason = error?.code || "admin_customer_action_failed";
    if (!error?.code) console.error("admin customer action failed", safeErrorMessage(error));
    await auditAdmin(request, {
      admin: auth.admin,
      action: `admin.customer.${parsed.data.action}`,
      resource: tenantId,
      status: "failed",
      metadata: { reason }
    });
    const publicMessages = {
      customer_not_found: "العميل غير موجود.",
      customer_removed: "العميل مُزال ولا يمكن تعديل بياناته.",
      customer_already_removed: "العميل مُزال بالفعل.",
      confirmation_mismatch: "اسم مساحة العمل غير مطابق.",
      admin_tenant_cannot_be_removed: "لا يمكن إزالة مساحة عمل مرتبطة بحساب أدمن نشط.",
      plan_not_found: "الباقة المحددة غير متاحة.",
      subscription_not_found: "لا يوجد اشتراك منصة لهذا العميل.",
      wallet_unavailable: "تعذر الوصول إلى محفظة العميل."
    };
    return Response.json({ ok: false, reason, message: publicMessages[reason] || "تعذر تنفيذ العملية الإدارية." }, { status: error?.status || 500 });
  }
}
