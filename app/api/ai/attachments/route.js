import { get } from "@vercel/blob";
import { requireSession } from "../../../../src/server/session.js";

export async function GET(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!process.env.BLOB_READ_WRITE_TOKEN) return Response.json({ ok: false, message: "المرفق غير متاح." }, { status: 404 });
  const path = new URL(request.url).searchParams.get("path") || "";
  const allowedPrefix = `ai/${auth.session.tenantId}/${auth.session.userId}/`;
  if (!path.startsWith(allowedPrefix) || path.includes("..")) {
    return Response.json({ ok: false, message: "لا تملك صلاحية الوصول إلى هذا المرفق." }, { status: 403 });
  }
  try {
    const result = await get(path, { access: "public" });
    if (!result) return Response.json({ ok: false, message: "المرفق غير موجود." }, { status: 404 });
    const headers = new Headers(result.headers);
    headers.set("Cache-Control", "private, max-age=300");
    headers.set("Content-Disposition", "inline");
    headers.set("X-Content-Type-Options", "nosniff");
    return new Response(result.stream, { headers });
  } catch {
    return Response.json({ ok: false, message: "تعذر تحميل المرفق." }, { status: 404 });
  }
}
