import { authenticateCustomApi, customApiError, withIdempotency } from "../../../../src/server/custom-integrations.js";
import { createApiSubscription, listApiSubscriptions } from "../../../../src/server/custom-api-resources.js";

export async function GET(req) {
  const auth = await authenticateCustomApi(req, "subscriptions:read");
  if (!auth.ok) return customApiError(auth);
  const url = new URL(req.url);
  return Response.json(await listApiSubscriptions(auth, { limit: url.searchParams.get("limit"), cursor: url.searchParams.get("cursor") }));
}

export async function POST(req) {
  const auth = await authenticateCustomApi(req, "subscriptions:write");
  if (!auth.ok) return customApiError(auth);
  const body = await req.json().catch(() => ({}));
  return withIdempotency({
    req, auth, routeKey: "POST:/api/v1/subscriptions", body,
    execute: async () => {
      const result = await createApiSubscription(auth, body);
      return result.error
        ? { status: result.status, body: { error: { code: result.error, message: result.error === "resource_not_found" ? "العميل غير موجود." : "بيانات الاشتراك غير صحيحة.", request_id: auth.requestId } } }
        : result;
    }
  });
}
