import { sendTestEmail } from "../../../../src/server/email/resend.service.js";
import { getSession } from "../../../../src/server/session.js";
import { isValidEmail, normalizeEmail, safeErrorMessage } from "../../../../src/server/security.js";

export async function POST(req) {
  const session = await getSession(req).catch(() => null);
  const allowed = process.env.NODE_ENV !== "production" || ["owner", "admin"].includes(session?.role);
  if (!allowed) return Response.json({ ok: false }, { status: 404 });
  const body = await req.json();
  const to = normalizeEmail(body.to);
  if (!isValidEmail(to)) return Response.json({ ok: false, message: "Invalid email" }, { status: 400 });
  try {
    const sent = await sendTestEmail({ to, locale: body.locale === "en" ? "en" : "ar" });
    return Response.json({ ok: true, providerMessageId: sent?.id || null });
  } catch (error) {
    console.error("test-resend failed", safeErrorMessage(error));
    return Response.json({ ok: false, message: "Email provider rejected the request" }, { status: 502 });
  }
}
