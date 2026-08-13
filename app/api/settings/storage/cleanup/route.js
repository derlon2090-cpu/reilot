import { requireSession } from "../../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../../src/server/campaign-contacts.js";
import { cleanupTenantStorage, getStorageCleanupPreview } from "../../../../../src/server/storage-cleanup.js";

function canManageStorage(session) {
  return ["owner", "admin"].includes(String(session?.role || "").toLowerCase());
}

function forbidden() {
  return Response.json({ ok: false, message: "إخلاء مساحة الحساب متاح لمالك الحساب أو المسؤول فقط." }, { status: 403 });
}

function failure(error) {
  return Response.json({
    ok: false,
    message: error?.status ? error.message : "تعذر إدارة مساحة الحساب حاليًا."
  }, { status: error?.status || 500 });
}

export async function GET(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!canManageStorage(auth.session)) return forbidden();
  try {
    const preview = await getStorageCleanupPreview(auth.session.tenantId);
    return Response.json({ ok: true, preview });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!canManageStorage(auth.session)) return forbidden();
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير صالح." }, { status: 403 });
  try {
    const input = await request.json().catch(() => ({}));
    if (input.confirmation !== "DELETE_OLD_ACCOUNT_DATA") {
      return Response.json({ ok: false, message: "يلزم تأكيد التحذير قبل إخلاء المساحة." }, { status: 400 });
    }
    const result = await cleanupTenantStorage(auth.session, input);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return failure(error);
  }
}
