import { safeJson, validateTenantRequest } from "../../_lib/guard";

export function POST(req) {
  const auth = validateTenantRequest(req);
  if (!auth.ok) return safeJson({ ok: false, error: auth.error }, { status: auth.status });

  return safeJson({
    ok: true,
    instance: {
      id: "instance-scaffold",
      tenantId: auth.tenantId,
      status: "pending_qr",
      provider: "evolution"
    }
  });
}
