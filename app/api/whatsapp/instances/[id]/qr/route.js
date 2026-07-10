import { safeJson, validateTenantRequest } from "../../../_lib/guard";

export function GET(req, { params }) {
  const auth = validateTenantRequest(req);
  if (!auth.ok) return safeJson({ ok: false, error: auth.error }, { status: auth.status });

  return safeJson({
    ok: true,
    instanceId: params.id,
    qrBase64: "mocked-qr-from-provider",
    expiresIn: 60
  });
}
