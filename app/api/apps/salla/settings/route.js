import { requireSession } from "../../../../../src/server/session.js";
import { getSallaDashboard, saveSallaSettings } from "../../../../../src/server/salla-app.js";

export async function GET(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const data = await getSallaDashboard(auth.session.tenantId);
  return Response.json({ ok: true, settings: data.connection, templates: data.templates });
}

export async function POST(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => ({}));
  try {
    const result = await saveSallaSettings(auth.session.tenantId, body);
    if (!result.ok) return Response.json({ ok: false, message: "اربط متجر سلة أولًا." }, { status: 409 });
    return Response.json({ ok: true, ...(await getSallaDashboard(auth.session.tenantId)) });
  } catch (error) {
    return Response.json({ ok: false, message: error.message || "تعذر حفظ إعدادات سلة." }, { status: 400 });
  }
}
