import { requireSession } from "../../../../../../../src/server/session.js";
import { excludeSallaCart } from "../../../../../../../src/server/salla-reports.js";

export async function PATCH(request, { params }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json().catch(() => ({}));
    if (body.action !== "exclude") return Response.json({ ok: false, message: "الإجراء غير مدعوم." }, { status: 400 });
    const { id } = await params;
    const result = await excludeSallaCart({ tenantId: auth.session.tenantId, cartId: id });
    return Response.json(result);
  } catch (error) {
    return Response.json({ ok: false, message: error.message || "تعذر تحديث السلة." }, { status: error.status || 500 });
  }
}
