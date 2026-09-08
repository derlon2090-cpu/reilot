import { requireSession } from "../../../../src/server/session.js";
import { getTenantStorage } from "../../../../src/server/tenant-storage.js";

export const maxDuration = 60;

export async function GET(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  try {
    const usage = await getTenantStorage(auth.session.tenantId);
    return Response.json({ ok: true, usage }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ ok: false, message: "تعذر تحميل تفاصيل استهلاك المساحة." }, { status: 500 });
  }
}
