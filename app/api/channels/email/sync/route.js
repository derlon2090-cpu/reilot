import { sameOriginRequest } from "../../../../../src/server/campaign-contacts.js";
import { resendProviderHealth } from "../../../../../src/lib/email/resend.js";
import { query } from "../../../../../src/server/db.js";
import { requireSession } from "../../../../../src/server/session.js";

export async function POST(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (String(auth.session.role || "").toLowerCase() === "viewer") {
    return Response.json({ ok: false, message: "لا تملك صلاحية مزامنة القناة." }, { status: 403 });
  }
  if (!sameOriginRequest(request)) return Response.json({ ok: false, reason: "invalid_origin" }, { status: 403 });
  try {
    const health = await resendProviderHealth({ force: true });
    await query(
      `INSERT INTO activity_logs(tenant_id,user_id,type,title,metadata)
       VALUES($1,$2,'channel.email_domain_synced','Email domain status synchronized',$3::jsonb)`,
      [auth.session.tenantId, auth.session.userId, JSON.stringify(health)]
    );
    return Response.json({ ok: true, health });
  } catch (error) {
    return Response.json({ ok: false, reason: error.code || "email_sync_failed", message: error.message || "تعذر مزامنة حالة النطاق." }, { status: 502 });
  }
}
