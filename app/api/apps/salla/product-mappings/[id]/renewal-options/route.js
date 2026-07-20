import { requireSession } from "../../../../../../../src/server/session.js";
import {
  disableRenewalOption,
  listRenewalOptions,
  saveRenewalOption
} from "../../../../../../../src/server/product-renewal-options.js";

export async function GET(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const items = await listRenewalOptions({ tenantId: auth.session.tenantId, mappingId: id });
  return Response.json({ ok: true, items });
}

export async function POST(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const result = await saveRenewalOption({ tenantId: auth.session.tenantId, mappingId: id, input: body });
  return Response.json(result, { status: result.ok ? 201 : result.reason === "mapping_not_found" ? 404 : 400 });
}

export async function PUT(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const result = await saveRenewalOption({ tenantId: auth.session.tenantId, mappingId: id, optionId: body.id, input: body });
  return Response.json(result, { status: result.ok ? 200 : result.reason === "renewal_option_not_found" ? 404 : 400 });
}

export async function DELETE(req, { params }) {
  const auth = await requireSession(req);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const optionId = new URL(req.url).searchParams.get("optionId");
  const ok = optionId && await disableRenewalOption({ tenantId: auth.session.tenantId, mappingId: id, optionId });
  return Response.json({ ok: Boolean(ok) }, { status: ok ? 200 : 404 });
}
