import { z } from "zod";
import { query, transaction } from "../../../../src/server/db.js";
import { requireSession } from "../../../../src/server/session.js";
import { normalizeContactEmail, normalizeContactPhone, sameOriginRequest } from "../../../../src/server/campaign-contacts.js";

const updateSchema = z.object({
  displayName: z.string().trim().min(1).max(160).optional(),
  companyName: z.string().trim().max(160).nullable().optional(),
  email: z.string().trim().max(254).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(["active", "archived", "blocked", "merge_review"]).optional(),
  channels: z.object({ email: z.boolean().optional(), whatsapp: z.boolean().optional() }).optional()
});

function canMutate(role) {
  return String(role || "").toLowerCase() !== "viewer";
}

function canDelete(role) {
  return ["owner", "admin"].includes(String(role || "").toLowerCase());
}

async function contactRecord(tenantId, contactId) {
  const result = await query(
    `SELECT c.id, c.display_name AS "displayName", c.company_name AS "companyName", c.source, c.status, c.notes,
            c.created_at AS "createdAt", c.updated_at AS "updatedAt",
            COALESCE(points.items, '[]'::json) AS points
       FROM contacts c
       LEFT JOIN LATERAL (
         SELECT json_agg(json_build_object('id',cp.id,'channel',cp.channel,'value',cp.display_value,
                  'status',cp.status,'consentStatus',cp.consent_status,'isPrimary',cp.is_primary)
                ORDER BY cp.is_primary DESC, cp.created_at) AS items
           FROM contact_points cp WHERE cp.tenant_id=c.tenant_id AND cp.contact_id=c.id
       ) points ON true
      WHERE c.tenant_id=$1 AND c.id=$2`,
    [tenantId, contactId]
  );
  return result.rows[0] || null;
}

export async function GET(request, { params }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  const { contactId } = await params;
  const item = await contactRecord(auth.session.tenantId, contactId);
  if (!item) return Response.json({ ok: false, reason: "not_found" }, { status: 404 });
  const activity = await query(
    `SELECT type,title,metadata,created_at AS "createdAt"
       FROM activity_logs
      WHERE tenant_id=$1 AND metadata->>'contactId'=$2
      UNION ALL
     SELECT 'campaign.recipient.' || cr.status AS type,
            'Campaign recipient ' || cr.status AS title,
            jsonb_build_object('campaignName',ca.name,'channel',cr.channel,'status',cr.status) AS metadata,
            COALESCE(cr.updated_at,cr.created_at) AS "createdAt"
       FROM campaign_recipients cr
       JOIN campaigns ca ON ca.id=cr.campaign_id AND ca.tenant_id=cr.tenant_id
      WHERE cr.tenant_id=$1 AND cr.contact_id=$2
      ORDER BY "createdAt" DESC LIMIT 50`,
    [auth.session.tenantId, contactId]
  );
  return Response.json({ ok: true, item, activity: activity.rows, permissions: { canEdit: canMutate(auth.session.role), canDelete: canDelete(auth.session.role) } });
}

export async function PATCH(request, { params }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, reason: "invalid_origin" }, { status: 403 });
  if (!canMutate(auth.session.role)) return Response.json({ ok: false, message: "ليس لديك صلاحية للتعديل." }, { status: 403 });
  const { contactId } = await params;
  const parsed = updateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ ok: false, reason: "invalid_input", message: "تحقق من البيانات المدخلة." }, { status: 400 });
  const normalizedEmail = parsed.data.email ? normalizeContactEmail(parsed.data.email) : null;
  const normalizedPhone = parsed.data.phone ? normalizeContactPhone(parsed.data.phone) : null;
  if (parsed.data.email && !normalizedEmail) return Response.json({ ok: false, reason: "invalid_email", message: "البريد الإلكتروني غير صالح." }, { status: 400 });
  if (parsed.data.phone && !normalizedPhone) return Response.json({ ok: false, reason: "invalid_phone", message: "رقم الجوال أو واتساب غير صالح." }, { status: 400 });
  try {
    await transaction(async (client) => {
      const current = await client.query(`SELECT * FROM contacts WHERE tenant_id=$1 AND id=$2 FOR UPDATE`, [auth.session.tenantId, contactId]);
      if (!current.rowCount) throw Object.assign(new Error("not_found"), { status: 404 });
      const row = current.rows[0];
      await client.query(
        `UPDATE contacts SET display_name=$3, status=$4, notes=$5, company_name=$6, updated_at=now() WHERE tenant_id=$1 AND id=$2`,
        [auth.session.tenantId, contactId, parsed.data.displayName ?? row.display_name, parsed.data.status ?? row.status,
         parsed.data.notes === undefined ? row.notes : parsed.data.notes,
         parsed.data.companyName === undefined ? row.company_name : parsed.data.companyName]
      );

      if (parsed.data.email !== undefined) {
        const existing = await client.query(`SELECT normalized_value FROM contact_points WHERE tenant_id=$1 AND contact_id=$2 AND channel='email' LIMIT 1`, [auth.session.tenantId, contactId]);
        if (normalizedEmail) {
          const conflict = await client.query(`SELECT 1 FROM contact_points WHERE tenant_id=$1 AND channel='email' AND normalized_value=$2 AND contact_id<>$3 LIMIT 1`, [auth.session.tenantId, normalizedEmail, contactId]);
          if (conflict.rowCount) throw Object.assign(new Error("duplicate_contact"), { code: "duplicate_contact" });
        }
        if (existing.rows[0]?.normalized_value !== normalizedEmail) {
          await client.query(`DELETE FROM contact_points WHERE tenant_id=$1 AND contact_id=$2 AND channel='email'`, [auth.session.tenantId, contactId]);
        }
        if (normalizedEmail && existing.rows[0]?.normalized_value !== normalizedEmail) await client.query(
          `INSERT INTO contact_points(tenant_id,contact_id,channel,normalized_value,display_value,status,consent_status,is_primary,source)
           VALUES($1,$2,'email',$3,$3,'active','unknown',true,'manual')`,
          [auth.session.tenantId, contactId, normalizedEmail]
        );
      }
      if (parsed.data.phone !== undefined) {
        const existing = await client.query(`SELECT normalized_value FROM contact_points WHERE tenant_id=$1 AND contact_id=$2 AND channel='whatsapp' LIMIT 1`, [auth.session.tenantId, contactId]);
        if (normalizedPhone) {
          const conflict = await client.query(`SELECT 1 FROM contact_points WHERE tenant_id=$1 AND channel IN ('phone','whatsapp') AND normalized_value=$2 AND contact_id<>$3 LIMIT 1`, [auth.session.tenantId, normalizedPhone, contactId]);
          if (conflict.rowCount) throw Object.assign(new Error("duplicate_contact"), { code: "duplicate_contact" });
        }
        if (existing.rows[0]?.normalized_value !== normalizedPhone) {
          await client.query(`DELETE FROM contact_points WHERE tenant_id=$1 AND contact_id=$2 AND channel IN ('phone','whatsapp')`, [auth.session.tenantId, contactId]);
        }
        if (normalizedPhone && existing.rows[0]?.normalized_value !== normalizedPhone) {
          for (const channel of ["phone", "whatsapp"]) {
            await client.query(
              `INSERT INTO contact_points(tenant_id,contact_id,channel,normalized_value,display_value,status,consent_status,is_primary,source)
               VALUES($1,$2,$3,$4,$4,'active','unknown',true,'manual')`,
              [auth.session.tenantId, contactId, channel, normalizedPhone]
            );
          }
        }
      }
      if (parsed.data.channels) {
        for (const channel of ["email", "whatsapp"]) {
          if (parsed.data.channels[channel] === undefined) continue;
          await client.query(
            `UPDATE contact_points SET status=$3,
                    consent_status=CASE WHEN $3='active' THEN 'granted' ELSE consent_status END, updated_at=now()
              WHERE tenant_id=$1 AND contact_id=$2 AND channel=$4`,
            [auth.session.tenantId, contactId, parsed.data.channels[channel] ? "active" : "blocked", channel]
          );
        }
      }
      const type = parsed.data.channels ? "contact.channels.updated" : parsed.data.status ? "contact.status.changed" : "contact.updated";
      await client.query(
        `INSERT INTO activity_logs(tenant_id,user_id,type,title,metadata) VALUES($1,$2,$3,$4,$5::jsonb)`,
        [auth.session.tenantId, auth.session.userId, type, "Campaign contact updated", JSON.stringify({ contactId, status: parsed.data.status || null })]
      );
    });
    return Response.json({ ok: true, item: await contactRecord(auth.session.tenantId, contactId) });
  } catch (error) {
    if (error.status === 404) return Response.json({ ok: false, reason: "not_found" }, { status: 404 });
    if (["23505", "duplicate_contact"].includes(error.code)) return Response.json({ ok: false, reason: "duplicate_contact", message: "البريد أو الرقم مرتبط بجهة اتصال أخرى." }, { status: 409 });
    throw error;
  }
}

export async function DELETE(request, { params }) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (!sameOriginRequest(request)) return Response.json({ ok: false, reason: "invalid_origin" }, { status: 403 });
  if (!canDelete(auth.session.role)) return Response.json({ ok: false, reason: "forbidden", message: "ليس لديك صلاحية للحذف." }, { status: 403 });
  const { contactId } = await params;
  const removed = await transaction(async (client) => {
    const current = await client.query(`SELECT display_name FROM contacts WHERE tenant_id=$1 AND id=$2 FOR UPDATE`, [auth.session.tenantId, contactId]);
    if (!current.rowCount) return null;
    await client.query(`DELETE FROM contacts WHERE tenant_id=$1 AND id=$2`, [auth.session.tenantId, contactId]);
    await client.query(
      `INSERT INTO activity_logs(tenant_id,user_id,type,title,metadata) VALUES($1,$2,'contact.deleted','Campaign contact deleted',$3::jsonb)`,
      [auth.session.tenantId, auth.session.userId, JSON.stringify({ contactId, displayName: current.rows[0].display_name })]
    );
    return current.rows[0];
  });
  if (!removed) return Response.json({ ok: false, reason: "not_found" }, { status: 404 });
  return Response.json({ ok: true });
}
