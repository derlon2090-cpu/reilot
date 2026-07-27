import { authenticateCustomApi, customApiError, withIdempotency } from "../../../../../src/server/custom-integrations.js";
import { findApiCustomer, updateApiCustomer } from "../../../../../src/server/custom-api-resources.js";

export async function GET(req, { params }) {
  const auth = await authenticateCustomApi(req, "customers:read");
  if (!auth.ok) return customApiError(auth);
  const { customerId } = await params;
  const item = await findApiCustomer(auth, customerId);
  if (!item) return customApiError({ ...auth, code: "resource_not_found", status: 404 });
  return Response.json({ data: item, request_id: auth.requestId });
}

export async function PATCH(req, { params }) {
  const auth = await authenticateCustomApi(req, "customers:write");
  if (!auth.ok) return customApiError(auth);
  const { customerId } = await params;
  const body = await req.json().catch(() => ({}));
  return withIdempotency({
    req,
    auth,
    routeKey: `PATCH:/api/v1/customers/${customerId}`,
    body,
    execute: async () => {
      const result = await updateApiCustomer(auth, customerId, body);
      return result.error
        ? {
            status: result.status,
            body: {
              error: {
                code: result.error,
                message: result.error === "resource_not_found" ? "العميل غير موجود." : "بيانات العميل غير صحيحة.",
                request_id: auth.requestId
              }
            }
          }
        : result;
    }
  });
}
