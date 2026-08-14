import { backendOrigin, trustedFrontendRequest } from "../../../[...path]/route.js";

const MAX_RELAY_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/png", "image/jpeg", "image/webp", "application/pdf", "text/plain",
  "audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg"
]);

function jsonError(code, message, status) {
  return Response.json({ ok: false, code, message }, { status, headers: { "Cache-Control": "no-store" } });
}

function validR2Hostname(value) {
  const hostname = String(value || "").toLowerCase();
  const suffix = ".r2.cloudflarestorage.com";
  if (!hostname.endsWith(suffix)) return false;
  const labels = hostname.slice(0, -suffix.length).split(".");
  const accountId = labels.pop() || "";
  if (!/^[a-f0-9]{16,64}$/.test(accountId)) return false;
  if (!labels.length) return true;
  const bucket = labels.join(".");
  return bucket.length <= 63
    && /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(bucket)
    && !bucket.includes("..");
}

function validSignedUploadUrl(value, attachmentId) {
  try {
    const url = new URL(String(value || ""));
    const query = new Map([...url.searchParams].map(([key, entry]) => [key.toLowerCase(), entry]));
    const escapedId = String(attachmentId || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return url.protocol === "https:"
      && validR2Hostname(url.hostname)
      && new RegExp(`/${escapedId}\\.[a-z0-9]+$`, "i").test(decodeURIComponent(url.pathname))
      && Boolean(query.get("x-amz-signature"))
      && Boolean(query.get("x-amz-credential"))
      && Boolean(query.get("x-amz-expires"));
  } catch {
    return false;
  }
}

async function uploadThroughBackend(request, attachmentId, contentType, body, fetchImpl) {
  try {
    const response = await fetchImpl(new URL(`/api/ai/attachments/${encodeURIComponent(attachmentId)}/upload`, backendOrigin()), {
      method: "PUT",
      headers: {
        Cookie: request.headers.get("cookie") || "",
        "Cache-Control": "no-store",
        "Content-Type": contentType,
        "Content-Length": String(body.byteLength),
        "X-Renvix-Frontend-Gateway": "ai-upload-fallback"
      },
      body,
      cache: "no-store",
      redirect: "manual",
      signal: request.signal
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok && payload.attachment) {
      return Response.json({ ok: true, attachment: payload.attachment }, { headers: { "Cache-Control": "no-store" } });
    }
    return jsonError(
      payload.code || "ATTACHMENT_UPLOAD_FAILED",
      payload.message || "تعذر رفع المرفق عبر المسار الآمن.",
      response.status || 502
    );
  } catch {
    return jsonError("ATTACHMENT_UPLOAD_FAILED", "تعذر الوصول إلى خدمة رفع المرفقات مؤقتًا.", 503);
  }
}

async function readLimitedBody(request) {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RELAY_BYTES) {
      await reader.cancel().catch(() => {});
      throw Object.assign(new Error("حجم المرفق أكبر من حد بوابة الرفع."), { code: "ATTACHMENT_TOO_LARGE", status: 413 });
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return body;
}

async function verifyPendingAttachment(request, attachmentId, fetchImpl) {
  const response = await fetchImpl(new URL(`/api/ai/attachments?id=${encodeURIComponent(attachmentId)}`, backendOrigin()), {
    method: "GET",
    headers: {
      Cookie: request.headers.get("cookie") || "",
      "Cache-Control": "no-store",
      "X-Renvix-Frontend-Gateway": "ai-upload"
    },
    cache: "no-store",
    redirect: "manual",
    signal: request.signal
  });
  const payload = await response.json().catch(() => ({}));
  if (response.status === 409 && payload.code === "ATTACHMENT_NOT_READY") return null;
  if (response.status === 401) return jsonError("AUTH_REQUIRED", "يلزم تسجيل الدخول لرفع المرفق.", 401);
  return jsonError("ATTACHMENT_FORBIDDEN", "تعذر التحقق من ملكية المرفق.", response.status === 404 ? 404 : 403);
}

async function completePendingAttachment(request, attachmentId, fetchImpl) {
  const response = await fetchImpl(new URL(`/api/ai/attachments/${encodeURIComponent(attachmentId)}/complete`, backendOrigin()), {
    method: "POST",
    headers: {
      Cookie: request.headers.get("cookie") || "",
      "Cache-Control": "no-store",
      "X-Renvix-Frontend-Gateway": "ai-upload"
    },
    cache: "no-store",
    redirect: "manual",
    signal: request.signal
  });
  const payload = await response.json().catch(() => ({}));
  if (response.ok && payload.attachment) return Response.json({ ok: true, attachment: payload.attachment }, { headers: { "Cache-Control": "no-store" } });
  return jsonError(payload.code || "UPLOAD_VERIFICATION_FAILED", payload.message || "تعذر التحقق من الملف المرفوع.", response.status || 409);
}

export async function relaySignedAttachmentUpload(request, { params }, fetchImpl = fetch) {
  if (!trustedFrontendRequest(request)) return jsonError("ATTACHMENT_FORBIDDEN", "طلب غير صالح.", 403);
  const { attachmentId } = await params;
  const contentType = String(request.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();
  if (!ALLOWED_TYPES.has(contentType)) return jsonError("ATTACHMENT_TYPE_NOT_ALLOWED", "نوع الملف غير مدعوم.", 415);
  const declaredSize = Number(request.headers.get("content-length") || 0);
  if (declaredSize > MAX_RELAY_BYTES) return jsonError("ATTACHMENT_TOO_LARGE", "حجم المرفق أكبر من حد بوابة الرفع.", 413);
  const signedUrl = request.headers.get("x-renvix-upload-url") || "";
  if (!validSignedUploadUrl(signedUrl, attachmentId)) {
    try {
      const body = await readLimitedBody(request);
      return uploadThroughBackend(request, attachmentId, contentType, body, fetchImpl);
    } catch (error) {
      if (error?.status) return jsonError(error.code, error.message, error.status);
      return jsonError("ATTACHMENT_UPLOAD_FAILED", "تعذر رفع المرفق عبر المسار الآمن.", 502);
    }
  }
  const verificationError = await verifyPendingAttachment(request, attachmentId, fetchImpl);
  if (verificationError) return verificationError;
  try {
    const body = await readLimitedBody(request);
    const uploaded = await fetchImpl(signedUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body,
      cache: "no-store",
      redirect: "manual",
      signal: request.signal
    });
    if (!uploaded.ok) return jsonError("R2_UPLOAD_FAILED", "تعذر رفع المرفق إلى التخزين الخاص.", 502);
    return completePendingAttachment(request, attachmentId, fetchImpl);
  } catch (error) {
    if (error?.status) return jsonError(error.code, error.message, error.status);
    return jsonError("R2_UPLOAD_FAILED", "تعذر رفع المرفق إلى التخزين الخاص.", 502);
  }
}

export const PUT = relaySignedAttachmentUpload;
