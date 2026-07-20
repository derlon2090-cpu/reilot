import { requireSession } from "../../../../../src/server/session.js";
import { getOrCreateOrderPortalLink } from "../../../../../src/server/order-portal-links.js";

export async function POST(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { orderId } = await params;
  const body = await req.json().catch(() => ({}));
  const result = await getOrCreateOrderPortalLink({
    tenantId: auth.session.tenantId,
    orderId,
    expiresInDays: body.expiresInDays
  });
  if (!result.ok) return Response.json(result, { status: 404 });
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
