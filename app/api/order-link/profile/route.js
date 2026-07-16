import { requireSession } from "../../../../src/server/session.js";
import { ensureOrderLinkProfile, saveOrderLinkProfile } from "../../../../src/server/order-links.js";

export async function GET(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const profile = await ensureOrderLinkProfile(auth.session.tenantId);
  return Response.json({ ok: true, profile });
}

export async function POST(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => ({}));
  const result = await saveOrderLinkProfile({ tenantId: auth.session.tenantId, ...body });
  if (!result.ok) {
    const status = result.reason === "slug_exists" ? 409 : 400;
    return Response.json({ ok: false, reason: result.reason }, { status });
  }
  return Response.json(result);
}
