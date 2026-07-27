import { requireSession } from "../../../../src/server/session.js";
import { createOrderInfoLink } from "../../../../src/server/order-links.js";
import { planEntitlementResponse } from "../../../../src/server/plan-entitlements.js";

export async function POST(req) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => ({}));
  if (!body.subscriptionId) return Response.json({ ok: false, reason: "subscription_required" }, { status: 400 });
  let result;
  try {
    result = await createOrderInfoLink({
      tenantId: auth.session.tenantId,
      userId: auth.session.userId,
      subscriptionId: body.subscriptionId,
      templateId: body.templateId || null,
      expiresInDays: body.expiresInDays,
      sendMethod: body.sendMethod
    });
  } catch (error) {
    const response = planEntitlementResponse(error);
    if (response) return response;
    throw error;
  }
  if (!result.ok) return Response.json(result, { status: 404 });
  return Response.json({ ok: true, ...result.item }, { status: 201 });
}

