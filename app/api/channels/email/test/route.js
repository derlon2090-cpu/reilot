import { z } from "zod";
import { sendTestEmail } from "../../../../../src/server/email/resend.service.js";
import { sameOriginRequest } from "../../../../../src/server/campaign-contacts.js";
import { query } from "../../../../../src/server/db.js";
import { requireSession } from "../../../../../src/server/session.js";

const schema = z.object({ email: z.string().trim().email().max(320) });

export async function POST(request) {
  const auth = await requireSession(request);
  if (!auth.ok) return auth.response;
  if (String(auth.session.role || "").toLowerCase() === "viewer") return Response.json({ ok: false, message: "لا تملك صلاحية الإرسال." }, { status: 403 });
  if (!sameOriginRequest(request)) return Response.json({ ok: false, reason: "invalid_origin" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ ok: false, reason: "invalid_email", message: "أدخل بريدًا إلكترونيًا صالحًا." }, { status: 400 });
  try {
    const sent = await sendTestEmail({ to: parsed.data.email, locale: "ar" });
    await query(`INSERT INTO activity_logs(tenant_id,user_id,type,title,metadata) VALUES($1,$2,'channel.email_test_sent','Email channel test sent',$3::jsonb)`, [auth.session.tenantId, auth.session.userId, JSON.stringify({ providerMessageId: sent?.id || null })]);
    return Response.json({ ok: true, providerMessageId: sent?.id || null });
  } catch (error) {
    return Response.json({ ok: false, reason: error.code || "email_test_failed", message: error.message || "تعذر إرسال بريد الاختبار." }, { status: 502 });
  }
}
