import { z } from "zod";
import { query } from "./db.js";

const nullableText = (max) => z.preprocess(
  (value) => value === "" || value === undefined ? null : value,
  z.string().trim().min(2).max(max).nullable()
);

export const profileSettingsSchema = z.object({
  fullName: z.string().trim().min(2, "الاسم قصير جدًا.").max(80, "الاسم طويل جدًا."),
  storeName: nullableText(80).optional(),
  phone: z.preprocess(
    (value) => value === "" || value === undefined ? null : value,
    z.string().trim().regex(/^\+[1-9]\d{7,14}$/, "أدخل رقم الهاتف بالصيغة الدولية.").nullable()
  ).optional()
});

export const preferencesSchema = z.object({
  language: z.enum(["ar", "en"]),
  theme: z.enum(["light", "dark", "system"]),
  interfaceDensity: z.enum(["comfortable", "medium", "compact"])
});

export const notificationsSchema = z.object({
  renewalBillingNotifications: z.boolean(),
  productUpdates: z.boolean(),
  messageFailureNotifications: z.boolean()
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "أدخل كلمة المرور الحالية."),
  newPassword: z.string()
    .min(10, "كلمة المرور يجب ألا تقل عن 10 أحرف.")
    .max(128)
    .regex(/[A-Za-z]/, "يجب أن تحتوي كلمة المرور على حرف واحد على الأقل.")
    .regex(/\d/, "يجب أن تحتوي كلمة المرور على رقم واحد على الأقل."),
  confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "كلمتا المرور غير متطابقتين.",
  path: ["confirmPassword"]
}).refine((data) => data.newPassword !== data.currentPassword, {
  message: "كلمة المرور الجديدة يجب أن تختلف عن الحالية.",
  path: ["newPassword"]
});

export function validationResponse(result) {
  const errors = result.error.flatten().fieldErrors;
  return Response.json({ ok: false, reason: "validation_error", errors }, { status: 400 });
}

export async function getSettingsProfile(session) {
  const result = await query(
    `SELECT u.name AS "fullName", u.email, u.image AS "avatarUrl", u.phone,
            COALESCE(st.name, '') AS "storeName", COALESCE(tm.role, u.role) AS role,
            COALESCE(s.language, 'ar') AS language,
            COALESCE(s.theme, 'light') AS theme,
            COALESCE(s.interface_density, 'comfortable') AS "interfaceDensity",
            u.mfa_enabled AS "mfaEnabled"
       FROM users u
       LEFT JOIN tenant_members tm ON tm.user_id = u.id AND tm.tenant_id = u.tenant_id
       LEFT JOIN LATERAL (
         SELECT name FROM stores WHERE tenant_id = u.tenant_id ORDER BY created_at LIMIT 1
       ) st ON true
       LEFT JOIN settings s ON s.tenant_id = u.tenant_id
      WHERE u.id = $1 AND u.tenant_id = $2
      LIMIT 1`,
    [session.userId, session.tenantId]
  );
  return result.rows[0] || null;
}

