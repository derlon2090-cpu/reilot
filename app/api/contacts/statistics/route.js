import { query } from "../../../../src/server/db.js";
import { requireSession } from "../../../../src/server/session.js";

export async function GET(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  const result = await query(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE c.status = 'active')::int AS active,
            count(*) FILTER (WHERE c.status IN ('blocked','archived') OR NOT EXISTS (
              SELECT 1 FROM contact_points p WHERE p.contact_id = c.id AND p.tenant_id = c.tenant_id AND p.status = 'active' AND p.consent_status <> 'revoked'
            ))::int AS excluded,
            count(*) FILTER (WHERE EXISTS (
              SELECT 1 FROM contact_points p WHERE p.contact_id = c.id AND p.tenant_id = c.tenant_id AND p.channel = 'whatsapp' AND p.status = 'active' AND p.consent_status <> 'revoked'
            ))::int AS "whatsappEligible",
            count(*) FILTER (WHERE EXISTS (
              SELECT 1 FROM contact_points p WHERE p.contact_id = c.id AND p.tenant_id = c.tenant_id AND p.channel = 'email' AND p.status = 'active' AND p.consent_status <> 'revoked'
            ))::int AS "emailEligible",
            count(*) FILTER (WHERE c.status = 'merge_review')::int AS "needsReview"
       FROM contacts c WHERE c.tenant_id = $1`,
    [auth.session.tenantId]
  );
  return Response.json({ ok: true, statistics: result.rows[0] });
}
