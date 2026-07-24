import { z } from "zod";
import { query, transaction } from "../../../src/server/db.js";
import { requireSession } from "../../../src/server/session.js";
import { enforceActivityRateLimit, sameOriginRequest, upsertCampaignContact } from "../../../src/server/campaign-contacts.js";

const createSchema = z.object({
  displayName: z.string().trim().max(160).optional().default(""),
  email: z.string().trim().max(254).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  companyName: z.string().trim().max(160).optional().nullable(),
  source: z.enum(["manual","salla","csv","order","api","campaign_import"]).optional().default("manual"),
  consentStatus: z.enum(["granted","unknown","revoked"]).optional().default("unknown")
});

export async function GET(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const search = String(url.searchParams.get("search") || "").trim();
  const status = String(url.searchParams.get("status") || "");
  const channel = String(url.searchParams.get("channel") || "");
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 20)));
  const offset = (page - 1) * limit;
  const values = [auth.session.tenantId];
  const where = ["c.tenant_id = $1"];
  if (search) {
    values.push(`%${search.toLowerCase()}%`);
    where.push(`(lower(c.display_name) LIKE $${values.length} OR EXISTS (SELECT 1 FROM contact_points sx WHERE sx.contact_id = c.id AND lower(sx.normalized_value) LIKE $${values.length}))`);
  }
  if (["active","archived","blocked","merge_review"].includes(status)) {
    values.push(status); where.push(`c.status = $${values.length}`);
  }
  if (["email","phone","whatsapp"].includes(channel)) {
    values.push(channel); where.push(`EXISTS (SELECT 1 FROM contact_points sc WHERE sc.contact_id = c.id AND sc.channel = $${values.length})`);
  }
  values.push(limit, offset);
  const result = await query(
    `SELECT c.id, c.display_name AS "displayName", c.company_name AS "companyName", c.source, c.status,
            c.created_at AS "createdAt", c.updated_at AS "updatedAt",
            COALESCE(points.items, '[]'::json) AS points,
            count(*) OVER()::int AS "totalCount"
       FROM contacts c
       LEFT JOIN LATERAL (
         SELECT json_agg(json_build_object('id',cp.id,'channel',cp.channel,'value',cp.display_value,
                  'status',cp.status,'consentStatus',cp.consent_status,'isPrimary',cp.is_primary)
                ORDER BY cp.is_primary DESC, cp.created_at) AS items
           FROM contact_points cp WHERE cp.tenant_id = c.tenant_id AND cp.contact_id = c.id
       ) points ON true
      WHERE ${where.join(" AND ")}
      ORDER BY c.created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );
  return Response.json({ ok: true, items: result.rows, page, limit, total: result.rows[0]?.totalCount || 0 });
}

export async function POST(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, reason: "invalid_origin" }, { status: 403 });
  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ ok: false, reason: "invalid_input", issues: parsed.error.issues }, { status: 400 });
  try {
    const item = await transaction(async (client) => {
      if (!await enforceActivityRateLimit(client, { tenantId: auth.session.tenantId, userId: auth.session.userId, action: "contact.upserted" })) {
        throw Object.assign(new Error("تم تجاوز حد إضافة جهات الاتصال. حاول بعد دقيقة."), { code: "rate_limited" });
      }
      return upsertCampaignContact(client, { tenantId: auth.session.tenantId, userId: auth.session.userId, ...parsed.data });
    });
    return Response.json({ ok: true, item }, { status: 201 });
  } catch (error) {
    return Response.json({ ok: false, reason: error.code || "contact_failed", message: error.message }, { status: error.code === "rate_limited" ? 429 : 400 });
  }
}
