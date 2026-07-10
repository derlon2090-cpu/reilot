export function validateTenantRequest(req) {
  const tenantId = req.headers.get("x-tenant-id");
  const userId = req.headers.get("x-user-id");

  if (!tenantId || !userId) {
    return { ok: false, status: 401, error: "Authentication required" };
  }

  return { ok: true, tenantId, userId };
}

export function safeJson(payload, init) {
  const text = JSON.stringify(payload);
  if (/EVOLUTION_API_KEY|server-key|instanceToken|instance_token/i.test(text)) {
    return Response.json({ ok: false, error: "Unsafe response payload" }, { status: 500 });
  }
  return Response.json(payload, init);
}
