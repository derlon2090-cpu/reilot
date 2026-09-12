import { z } from "zod";
import { auditAdmin, requireAdminPermission } from "../../../../../../src/server/admin-auth.js";
import { transaction } from "../../../../../../src/server/db.js";
import { safeErrorMessage } from "../../../../../../src/server/security.js";

const inputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("suspend_user"), confirmation: z.string().trim().email().max(320) }),
  z.object({ action: z.literal("restore_user") }),
  z.object({ action: z.literal("remove_user"), confirmation: z.string().trim().email().max(320) })
]);

function actionError(code, status = 409) {
  return Object.assign(new Error(code), { code, status });
}

export async function POST(request, { params }) {
  const auth = await requireAdminPermission(request, "customers", "update");
  if (!auth.ok) return auth.response;
  const { userId } = await params;
  const parsed = inputSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ ok: false, reason: "validation_error", errors: parsed.error.flatten().fieldErrors }, { status: 400 });

  try {
    const result = await transaction(async (client) => {
      const found = await client.query(
        `SELECT u.id,u.email,u.account_status AS status,u.tenant_id AS "tenantId",
                EXISTS(SELECT 1 FROM admin_users au WHERE au.user_id=u.id AND au.status='active') AS "isAdmin"
           FROM users u WHERE u.id=$1 LIMIT 1 FOR UPDATE`,
        [userId]
      );
      const user = found.rows[0];
      if (!user) throw actionError("user_not_found", 404);
      if (user.isAdmin) throw actionError("admin_user_cannot_be_changed", 403);
      if (Object.hasOwn(parsed.data, "confirmation") && parsed.data.confirmation.toLowerCase() !== user.email.toLowerCase()) {
        throw actionError("confirmation_mismatch", 400);
      }

      const nextStatus = parsed.data.action === "restore_user" ? "active" : parsed.data.action === "suspend_user" ? "suspended" : "removed";
      if (user.status === nextStatus) throw actionError(nextStatus === "active" ? "user_already_active" : `user_already_${nextStatus}`);
      if (user.status === "removed" && parsed.data.action === "suspend_user") throw actionError("user_removed");

      await client.query(
        `UPDATE users SET account_status=$2,
                suspended_at=CASE WHEN $2='suspended' THEN now() ELSE NULL END,
                removed_at=CASE WHEN $2='removed' THEN now() ELSE NULL END,
                updated_at=now()
          WHERE id=$1`,
        [user.id, nextStatus]
      );
      const sessions = await client.query(
        `UPDATE sessions SET expires_at=now(),updated_at=now()
          WHERE user_id=$1 AND expires_at>now() RETURNING id`,
        [user.id]
      );
      return { userId: user.id, tenantId: user.tenantId, email: user.email, previousStatus: user.status, status: nextStatus, disabledSessions: sessions.rowCount || 0 };
    });

    await auditAdmin(request, {
      admin: auth.admin,
      action: `admin.user.${parsed.data.action}`,
      resource: userId,
      metadata: { tenantId: result.tenantId, previousStatus: result.previousStatus, status: result.status, disabledSessions: result.disabledSessions }
    });
    const messages = { suspend_user: "تم حظر المستخدم وإنهاء جلساته فورًا.", restore_user: "تمت استعادة المستخدم ويمكنه تسجيل الدخول مجددًا.", remove_user: "تمت إزالة المستخدم من المنصة وإنهاء جلساته دون حذف سجل التدقيق." };
    return Response.json({ ok: true, action: parsed.data.action, result, message: messages[parsed.data.action] }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    const reason = error?.code || "admin_user_action_failed";
    if (!error?.code) console.error("admin user action failed", safeErrorMessage(error));
    await auditAdmin(request, { admin: auth.admin, action: `admin.user.${parsed.data.action}`, resource: userId, status: "failed", metadata: { reason } });
    const messages = {
      user_not_found: "المستخدم غير موجود.", admin_user_cannot_be_changed: "لا يمكن حظر أو إزالة حساب أدمن نشط.",
      confirmation_mismatch: "البريد الإلكتروني غير مطابق.", user_already_active: "المستخدم نشط بالفعل.",
      user_already_suspended: "المستخدم محظور بالفعل.", user_already_removed: "المستخدم مُزال بالفعل.", user_removed: "المستخدم مُزال؛ استخدم الاستعادة بدل الحظر."
    };
    return Response.json({ ok: false, reason, message: messages[reason] || "تعذر تنفيذ العملية على المستخدم." }, { status: error?.status || 500 });
  }
}
