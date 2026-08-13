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
    getStorageCleanupPreview(session.tenantId),
    getAIChatStorage(session)
  ]);
  const tenantAIStorage = account.categories.find((item) => item.label === "محادثات ذكاء Renvix")?.bytes || 0;
  const accountCategories = account.categories.filter((item) => item.label !== "محادثات ذكاء Renvix");
  const chatTotal = Math.max(0, Number(chatStorage.totalBytes || 0));
  const chatCategory = {
    key: CHAT_CATEGORY,
    label: "محادثات ذكاء Renvix",
    description: "أقدم محادثاتك غير المثبتة، مع إبقاء أحدث محادثة.",
    count: chatStorage.cleanableConversations,
    bytes: chatTotal,
    cleanableBytes: Math.min(chatTotal, chatStorage.cleanableBytes),
    protectedBytes: Math.max(0, chatTotal - chatStorage.cleanableBytes),
    selectable: chatStorage.cleanableBytes > 0
  };
  const visibleAccountCategories = accountCategories.map((item) => ({
    ...item,
    selectable: canManageAccountStorage && item.cleanableBytes > 0
  }));
  const sharedAIBytes = Math.max(0, Number(tenantAIStorage) - chatTotal);
  if (sharedAIBytes > 0) visibleAccountCategories.push({
    key: "protected:ai-shared",
    label: "بيانات ذكاء Renvix الأخرى",
    description: "استخدام الخطة وتفضيلات الذكاء أو محادثات أعضاء الحساب الآخرين؛ بيانات محمية من التنظيف الشخصي.",
    count: 0,
    bytes: sharedAIBytes,
    cleanableBytes: 0,
    protectedBytes: sharedAIBytes,
    selectable: false
  });
  const accountCleanableBytes = canManageAccountStorage
    ? visibleAccountCategories.reduce((sum, item) => sum + Number(item.cleanableBytes || 0), 0)
    : 0;
  return {
    totalBytes: account.totalBytes,
    cleanableBytes: accountCleanableBytes + chatCategory.cleanableBytes,
    cleanableRows: (canManageAccountStorage ? account.cleanableRows : 0) + chatCategory.count,
    categories: [chatCategory, ...visibleAccountCategories],
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
    if (!categories.length) return Response.json({ ok: false, message: "اختر عنصرًا واحدًا على الأقل من البيانات القابلة للإخلاء." }, { status: 400 });

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
