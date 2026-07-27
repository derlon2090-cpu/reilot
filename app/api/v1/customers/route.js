import { authenticateCustomApi, customApiError, withIdempotency } from "../../../../src/server/custom-integrations.js";
import { createApiCustomer, listApiCustomers } from "../../../../src/server/custom-api-resources.js";

export async function GET(req) {
  const auth = await authenticateCustomApi(req, "customers:read");
  if (!auth.ok) return customApiError(auth);
  const url = new URL(req.url);
  const body = await listApiCustomers(auth, { limit: url.searchParams.get("limit"), cursor: url.searchParams.get("cursor") });
  return Response.json(body, { headers: { "X-RateLimit-Limit": String(auth.rateLimit.limit), "X-RateLimit-Remaining": String(auth.rateLimit.remaining) } });
}

export async function POST(req) {
  const auth = await authenticateCustomApi(req, "customers:write");
  if (!auth.ok) return customApiError(auth);
  const body = await req.json().catch(() => ({}));
  return withIdempotency({
    req, auth, routeKey: "POST:/api/v1/customers", body,
    execute: async () => {
      const result = await createApiCustomer(auth, body);
      return result.error
        ? { status: result.status, body: { error: { code: result.error, message: "بعض البيانات المرسلة غير صحيحة.", request_id: auth.requestId } } }
        : result;
    }
  });
}
