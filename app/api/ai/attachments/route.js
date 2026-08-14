import { requireSession } from "../../../../src/server/session.js";
import { getAttachmentDownload } from "../../../../src/server/attachments/service.js";

export async function GET(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const id = url.searchParams.get("id") || "";
  try {
    const download = await getAttachmentDownload(auth.session, id, { download: url.searchParams.get("download") === "1" });
    return Response.redirect(download.url, 307);
  } catch (error) {
    return Response.json({ ok: false, code: error?.code || "ATTACHMENT_NOT_FOUND", message: error?.message || "المرفق غير متاح." }, { status: Number(error?.status || 404) });
  }
}
