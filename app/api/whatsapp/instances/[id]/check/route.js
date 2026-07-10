import { safeJson, validateTenantRequest } from "../../../_lib/guard";

export function POST(req, { params }) {
  const auth = validateTenantRequest(req);
  if (!auth.ok) return safeJson({ ok: false, error: auth.error }, { status: auth.status });

  return safeJson({
    ok: true,
    instanceId: params.id,
    status: "connected",
    checkedAt: new Date().toISOString()
  });
}
