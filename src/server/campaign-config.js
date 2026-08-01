import { z } from "zod";

const campaignKeywordSchema = z.string().trim().min(1).max(80);
const campaignDaySchema = z.coerce.number().int().min(0).max(6);

export const campaignCreateSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(600).optional().nullable(),
  channel: z.enum(["whatsapp", "email"]),
  whatsappChannelId: z.string().uuid().optional().nullable(),
  templateId: z.string().uuid().optional().nullable(),
  metaTemplateId: z.string().uuid().optional().nullable(),
  groupId: z.string().uuid().optional().nullable(),
  subject: z.string().trim().max(200).optional().nullable(),
  body: z.string().trim().min(1).max(12000),
  isEnabled: z.boolean().optional().default(true),
  scheduledFor: z.coerce.date(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  timezone: z.string().trim().min(1).max(80).optional().default("Asia/Riyadh"),
  allowedDays: z.array(campaignDaySchema).min(1).max(7).transform((days) => [...new Set(days)].sort()),
  minDelaySeconds: z.coerce.number().int().min(20).max(3600).default(20),
  maxDelaySeconds: z.coerce.number().int().min(20).max(7200).default(120),
  contactKeywords: z.array(campaignKeywordSchema).max(12).optional().default([]),
  customKeywords: z.array(campaignKeywordSchema).max(50).optional().default([]),
  audienceFilter: z.record(z.string(), z.unknown()).optional().default({})
}).superRefine((value, context) => {
  if (value.maxDelaySeconds < value.minDelaySeconds) {
    context.addIssue({ code: "custom", path: ["maxDelaySeconds"], message: "الحد الأقصى للفاصل يجب أن يساوي الحد الأدنى أو يزيد عليه." });
  }
  if (value.isEnabled && value.scheduledFor.getTime() < Date.now() + 60_000) {
    context.addIssue({ code: "custom", path: ["scheduledFor"], message: "اختر موعد بدء بعد دقيقة واحدة على الأقل." });
  }
  if (value.channel === "whatsapp" && !value.whatsappChannelId) {
    context.addIssue({ code: "custom", path: ["whatsappChannelId"], message: "اختر جهاز واتساب متصلًا." });
  }
  if (value.channel === "email" && !String(value.subject || "").trim()) {
    context.addIssue({ code: "custom", path: ["subject"], message: "عنوان البريد مطلوب لحملات البريد الإلكتروني." });
  }
  const messageIssue = validateCampaignMessage(value.body);
  if (messageIssue) context.addIssue({ code: "custom", path: ["body"], message: messageIssue });
});

export function validateCampaignMessage(value) {
  const body = String(value || "");
  const opening = (body.match(/{{/g) || []).length;
  const closing = (body.match(/}}/g) || []).length;
  if (opening !== closing) return "تحقق من إغلاق المتغيرات بعلامتي }}.";
  for (const match of body.matchAll(/{{\s*([^{}]*?)\s*}}/g)) {
    const expression = match[1].trim();
    if (!expression) return "لا يمكن أن يكون المتغير فارغًا.";
    if (expression.includes("|")) {
      const choices = expression.split("|").map((choice) => choice.trim()).filter(Boolean);
      if (choices.length < 2) return "مجموعة الاختيارات العشوائية تحتاج خيارين صالحين على الأقل.";
    } else if (!/^[\p{L}\p{N}_-]+$/u.test(expression)) {
      return "استخدم اسم متغير بسيطًا أو افصل الاختيارات بعلامة |.";
    }
  }
  return null;
}

export function renderCampaignMessage(body, variables = {}, seed = 0) {
  let cursor = Math.abs(Number(seed) || 0);
  return String(body || "").replace(/{{\s*([^{}]+?)\s*}}/g, (_, expression) => {
    const choices = String(expression).split("|").map((choice) => choice.trim()).filter(Boolean);
    if (choices.length > 1) {
      const selected = choices[cursor % choices.length];
      cursor = (cursor * 31 + selected.length + 1) >>> 0;
      return selected;
    }
    const key = choices[0] || "";
    return Object.prototype.hasOwnProperty.call(variables, key) ? String(variables[key] ?? "") : `{{${key}}}`;
  });
}

export function campaignAudienceFilter(input) {
  return {
    ...(input.audienceFilter || {}),
    groupId: input.groupId || null,
    contactKeywords: input.contactKeywords || [],
    customKeywords: input.customKeywords || []
  };
}
