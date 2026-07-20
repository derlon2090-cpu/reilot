import { requireSession } from "../../../../../../../src/server/session.js";
import { syncAutomaticRenewalOptions } from "../../../../../../../src/server/product-renewal-options.js";

export async function POST(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const result = await syncAutomaticRenewalOptions(auth.session.tenantId);
  return Response.json({ ok: true, ...result });
}
