import { authenticateCustomApi, customApiError, withIdempotency } from "../../../../../src/server/custom-integrations.js";
import { findApiSubscription, updateApiSubscription } from "../../../../../src/server/custom-api-resources.js";

export async function GET(req, { params }) {
  const auth = await authenticateCustomApi(req, "subscriptions:read");
  if (!auth.ok) return customApiError(auth);
  const { subscriptionId } = await params;
  const item = await findApiSubscription(auth, subscriptionId);
  if (!item) return customApiError({ ...auth, code: "resource_not_found", status: 404 });
  return Response.json({ data: item, request_id: auth.requestId });
}

export async function PATCH(req, { params }) {
  const auth = await authenticateCustomApi(req, "subscriptions:write");
  if (!auth.ok) return customApiError(auth);
  const { subscriptionId } = await params;
  const body = await req.json().catch(() => ({}));
  return withIdempotency({
    req,
    auth,
    routeKey: `PATCH:/api/v1/subscriptions/${subscriptionId}`,
    body,
    execute: async () => {
      const result = await updateApiSubscription(auth, subscriptionId, body);
      return result.error
        ? {
            status: result.status,
            body: {
              error: {
                code: result.error,
                message: result.error === "resource_not_found" ? "الاشتراك غير موجود." : "بيانات الاشتراك غير صحيحة.",
                request_id: auth.requestId
              }
            }
          }
        : result;
    }
  });
}
