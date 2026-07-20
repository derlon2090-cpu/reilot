import { z } from "zod";
import { completeAdminPasswordReset } from "../../../../../src/server/admin-password-reset.js";
import { isValidEmail, safeErrorMessage } from "../../../../../src/server/security.js";

const schema = z.object({
  email: z.string().trim().refine(isValidEmail),
  code: z.string().regex(/^\d{6}$/),
  password: z.string().min(10).max(128).regex(/[A-Za-z]/).regex(/\d/),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, { path: ["confirmPassword"], message: "كلمتا المرور غير متطابقتين." });

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ ok: false, reason: "validation_error", errors: parsed.error.flatten().fieldErrors }, { status: 400 });
  try {
    const result = await completeAdminPasswordReset(request, parsed.data);
    return result.ok ? Response.json({ ok: true }) : Response.json({ ok: false, reason: result.reason }, { status: result.status || 400 });
  } catch (error) {
    console.error("admin reset-password failed", safeErrorMessage(error));
    return Response.json({ ok: false, reason: "server_error" }, { status: 500 });
  }
}
