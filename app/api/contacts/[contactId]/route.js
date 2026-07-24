import { z } from "zod";
import { query } from "../../../../src/server/db.js";
import { requireSession } from "../../../../src/server/session.js";
import { sameOriginRequest } from "../../../../src/server/campaign-contacts.js";

const updateSchema = z.object({
  displayName: z.string().trim().min(1).max(160).optional(),
  companyName: z.string().trim().max(160).nullable().optional(),
  status: z.enum(["active","archived","blocked","merge_review"]).optional(),
  notes: z.string().trim().max(2000).nullable().optional()
});

export async function PATCH(request, { params }) {
  const auth = await requireSession(request); if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, reason: "invalid_origin" }, { status: 403 });
  const { contactId } = await params;
  const parsed = updateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ ok: false, reason: "invalid_input" }, { status: 400 });
  const current = await query(`SELECT * FROM contacts WHERE tenant_id=$1 AND id=$2`, [auth.session.tenantId, contactId]);
  if (!current.rowCount) return Response.json({ ok: false, reason: "not_found" }, { status: 404 });
  const item = await query(
    `UPDATE contacts SET display_name=$3, company_name=$4, status=$5, notes=$6, updated_at=now()
      WHERE tenant_id=$1 AND id=$2
      RETURNING id, display_name AS "displayName", company_name AS "companyName", status, updated_at AS "updatedAt"`,
    [auth.session.tenantId, contactId,
     parsed.data.displayName ?? current.rows[0].display_name,
     parsed.data.companyName === undefined ? current.rows[0].company_name : parsed.data.companyName,
     parsed.data.status ?? current.rows[0].status,
     parsed.data.notes === undefined ? current.rows[0].notes : parsed.data.notes]
  );
  await query(`INSERT INTO activity_logs (tenant_id,user_id,type,title,metadata) VALUES($1,$2,'contact.updated','Campaign contact updated',$3::jsonb)`, [auth.session.tenantId, auth.session.userId, JSON.stringify({ contactId })]);
  return Response.json({ ok: true, item: item.rows[0] });
}

export async function DELETE(request, { params }) {
  const auth = await requireSession(request); if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, reason: "invalid_origin" }, { status: 403 });
  const { contactId } = await params;
  const result = await query(`UPDATE contacts SET status='archived', updated_at=now() WHERE tenant_id=$1 AND id=$2 RETURNING id`, [auth.session.tenantId, contactId]);
  if (!result.rowCount) return Response.json({ ok: false, reason: "not_found" }, { status: 404 });
  await query(`INSERT INTO activity_logs (tenant_id,user_id,type,title,metadata) VALUES($1,$2,'contact.archived','Campaign contact archived',$3::jsonb)`, [auth.session.tenantId, auth.session.userId, JSON.stringify({ contactId })]);
  return Response.json({ ok: true });
}
