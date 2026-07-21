import { auditAdmin, requireAdminPermission } from "../../../../../../src/server/admin-auth.js";
import { retryProvisioningCredentials } from "../../../../../../src/server/provisioning.js";

export async function POST(request, { params }) {
  const auth = await requireAdminPermission(request, "users", "write");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const result = await retryProvisioningCredentials(id);
  if (!result.ok) return Response.json(result, { status: result.reason === "not_retryable" ? 409 : 502 });
  await auditAdmin(request, { admin: auth.admin, action: "admin.provisioning.credentials.retry", resource: "account_provisioning_job", resourceId: id });
  return Response.json({ ok: true });
}
