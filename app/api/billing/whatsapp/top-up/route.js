import { requireSession } from "../../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../../src/server/campaign-contacts.js";

export async function POST(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) {
    return Response.json({ ok: false, reason: "invalid_origin" }, { status: 403 });
  }
  return Response.json({
    ok: false,
    code: "META_MANAGED_BILLING",
    message: "فوترة رسائل واتساب الرسمية وإدارتها تتمان مباشرة عبر Meta، ولا تبيع Renvix رصيد واتساب."
  }, { status: 410 });
}
