import { requireSession } from "../../../../../src/server/session.js";
import {
  listSallaOrderStatuses,
  syncSallaOrderStatuses
} from "../../../../../src/server/salla-templates.js";
import { sameOriginRequest } from "../../../../../src/server/campaign-contacts.js";

export async function GET(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  try {
    return Response.json({ ok: true, ...(await listSallaOrderStatuses({
      tenantId: auth.session.tenantId,
      userId: auth.session.userId
    })) });
  } catch (error) {
    return Response.json({ ok: false, code: error.code, message: error.message }, { status: error.status || 500 });
  }
}

export async function POST(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, message: "طلب غير موثوق." }, { status: 403 });
  try {
    return Response.json(await syncSallaOrderStatuses({
      tenantId: auth.session.tenantId,
      userId: auth.session.userId
    }));
  } catch (error) {
    return Response.json({ ok: false, code: error.code, message: error.message }, { status: error.status || 500 });
  }
}
