import { requireAdminPermission } from "../../../../../src/server/admin-auth.js";
import { adminSupportVersion, createSupportEventStream } from "../../../../../src/server/support-live.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request) {
  const auth = await requireAdminPermission(request, "support", "read");
  if (!auth.ok) return auth.response;
  return createSupportEventStream(request, adminSupportVersion);
}
