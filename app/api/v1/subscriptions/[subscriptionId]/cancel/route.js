import { authenticateCustomApi, customApiError, withIdempotency } from "../../../../../../src/server/custom-integrations.js";
import { cancelApiSubscription } from "../../../../../../src/server/custom-api-resources.js";

export async function POST(req, { params }) {
  const auth = await authenticateCustomApi(req, "subscriptions:write");
  if (!auth.ok) return customApiError(auth);
  const { subscriptionId } = await params;
  const body = await req.json().catch(() => ({}));
  return withIdempotency({
    req,
    auth,
    routeKey: `POST:/api/v1/subscriptions/${subscriptionId}/cancel`,
    body,
    execute: async () => {
      const result = await cancelApiSubscription(auth, subscriptionId, body);
      return result.error
        ? {
            status: result.status,
            body: {
              error: {
                code: result.error,
                message: "الاشتراك غير موجود.",
                request_id: auth.requestId
              }
            }
          }
        : result;
    }
  });
}
