import { authenticateCustomApi, customApiError, withIdempotency } from "../../../../../../src/server/custom-integrations.js";
import { renewApiSubscription } from "../../../../../../src/server/custom-api-resources.js";

export async function POST(req, { params }) {
  const auth = await authenticateCustomApi(req, "renewals:write");
  if (!auth.ok) return customApiError(auth);
  const { subscriptionId } = await params;
  const body = await req.json().catch(() => ({}));
  return withIdempotency({
    req,
    auth,
    routeKey: `POST:/api/v1/subscriptions/${subscriptionId}/renew`,
    body,
    execute: async () => {
      const result = await renewApiSubscription(auth, subscriptionId, body);
      return result.error
        ? {
            status: result.status,
            body: {
              error: {
                code: result.error,
                message: result.error === "resource_not_found" ? "الاشتراك غير موجود." : "بيانات التجديد غير صحيحة.",
                request_id: auth.requestId
              }
            }
          }
        : result;
    }
  });
}
