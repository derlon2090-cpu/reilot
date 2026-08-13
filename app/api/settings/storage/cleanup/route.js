import { requireSession } from "../../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../../src/server/campaign-contacts.js";
import { cleanupTenantStorage, getStorageCleanupPreview } from "../../../../../src/server/storage-cleanup.js";
import { cleanupAIChatStorage, getAIChatStorage } from "../../../../../src/server/ai/storage.js";
import { getTenantStorage } from "../../../../../src/server/tenant-storage.js";

const CHAT_CATEGORY = "ai_user_chats";

function canManageStorage(session) {
  return ["owner", "admin"].includes(String(session?.role || "").toLowerCase());
}

function forbidden() {
  return Response.json({ ok: false, message: "إخلاء مساحة الحساب متاح لمالك الحساب أو المسؤول فقط." }, { status: 403 });
}

async function cleanupPreview(session) {
  const canManageAccountStorage = canManageStorage(session);
  const [account, chatStorage] = await Promise.all([
    canManageAccountStorage
      ? getStorageCleanupPreview(session.tenantId)
      : Promise.resolve({ cleanableBytes: 0, cleanableRows: 0, categories: [] }),
    getAIChatStorage(session)
  ]);
  const chatCategory = {
    key: CHAT_CATEGORY,
    label: "محادثات ذكاء Renvix",
    description: "أقدم محادثاتك غير المثبتة، مع إبقاء أحدث محادثة.",
    count: chatStorage.cleanableConversations,
    bytes: chatStorage.cleanableBytes
  };
  return {
    cleanableBytes: account.cleanableBytes + chatCategory.bytes,
    cleanableRows: account.cleanableRows + chatCategory.count,
    categories: [chatCategory, ...account.categories],
    chatStorage,
    canManageAccountStorage
  };
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
  try {
    const preview = await cleanupPreview(auth.session);
    return Response.json({ ok: true, preview });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير صالح." }, { status: 403 });
  try {
    const input = await request.json().catch(() => ({}));
    if (input.confirmation !== "DELETE_OLD_ACCOUNT_DATA") {
      return Response.json({ ok: false, message: "يلزم تأكيد التحذير قبل إخلاء المساحة." }, { status: 400 });
    }
    const categories = [...new Set(Array.isArray(input.categories) ? input.categories.map(String) : [])];
    const accountCategories = categories.filter((key) => key !== CHAT_CATEGORY);
    if (accountCategories.length && !canManageStorage(auth.session)) return forbidden();
    if (!categories.length) return Response.json({ ok: false, message: "اختر نوعًا واحدًا على الأقل من البيانات القديمة." }, { status: 400 });

    const requestedBytes = Number(input.targetBytes || 0);
    if (!Number.isFinite(requestedBytes) || requestedBytes < 1 || requestedBytes > 1024 * 1024 * 1024) {
      return Response.json({ ok: false, message: "حدد مساحة صالحة تريد إخلاءها." }, { status: 400 });
    }
    let remainingBytes = requestedBytes;
    let freedBytes = 0;
    let deletedRows = 0;
    if (categories.includes(CHAT_CATEGORY) && remainingBytes > 0) {
      const chat = await cleanupAIChatStorage(auth.session, { targetBytes: remainingBytes });
      freedBytes += Number(chat.freedBytes || 0);
      deletedRows += Number(chat.deletedConversations || 0);
      remainingBytes = Math.max(0, remainingBytes - Number(chat.freedBytes || 0));
    }
    if (accountCategories.length && remainingBytes > 0) {
      const account = await cleanupTenantStorage(auth.session, { targetBytes: remainingBytes, categories: accountCategories });
      freedBytes += Number(account.freedBytes || 0);
      deletedRows += Number(account.deletedRows || 0);
    }
    const [storage, preview] = await Promise.all([
      getTenantStorage(auth.session.tenantId),
      cleanupPreview(auth.session)
    ]);
    return Response.json({ ok: true, storage, preview, freedBytes, deletedRows });
  } catch (error) {
    return failure(error);
  }
}
