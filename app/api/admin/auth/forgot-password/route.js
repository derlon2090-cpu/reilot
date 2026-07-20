import { z } from "zod";
import { requestAdminPasswordReset } from "../../../../../src/server/admin-password-reset.js";
import { isValidEmail, normalizeEmail, safeErrorMessage } from "../../../../../src/server/security.js";

const schema = z.object({ email: z.string().trim().min(1, "يرجى إدخال البريد الإلكتروني.").refine(isValidEmail, "يرجى إدخال بريد إلكتروني صحيح.") });

export async function POST(request) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ ok: false, errors: parsed.error.flatten().fieldErrors }, { status: 400 });
  try {
    const result = await requestAdminPasswordReset(request, normalizeEmail(parsed.data.email));
    return Response.json(result);
  } catch (error) {
    console.error("admin forgot-password failed", safeErrorMessage(error));
    return Response.json({ ok: false, message: "تعذر إرسال الرمز حاليًا. حاول مرة أخرى." }, { status: 500 });
  }
}
