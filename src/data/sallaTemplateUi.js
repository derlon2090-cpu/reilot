export const EMAIL_DESIGN_PRESETS = Object.freeze([
  { id: "classic", name: "كلاسيكي أنيق", caption: "بطاقة واضحة وهوية متوازنة" },
  { id: "modern", name: "حديث مميز", caption: "مساحات مريحة ولمسة عصرية" },
  { id: "minimal", name: "بسيط راقٍ", caption: "محتوى خفيف يركز على الرسالة" },
  { id: "premium", name: "فاخر داكن", caption: "تباين قوي للعروض المهمة" },
  { id: "editorial", name: "تحريري عالمي", caption: "أسلوب المجلات والعلامات الراقية" },
  { id: "commerce", name: "تجارة احترافية", caption: "مثالي للطلبات والمنتجات والعروض" },
  { id: "aurora", name: "أورورا متدرج", caption: "هوية حيوية بتدرج لوني ناعم" },
  { id: "executive", name: "تنفيذي رسمي", caption: "طابع مؤسسي واضح وموثوق" }
]);

export const SALLA_EMAIL_DESIGN_IDS = Object.freeze(["editorial", "commerce", "executive"]);
export const SALLA_EMAIL_DESIGN_PRESETS = Object.freeze(EMAIL_DESIGN_PRESETS.filter((item) => SALLA_EMAIL_DESIGN_IDS.includes(item.id)));
export const EMAIL_THEME_PALETTE = Object.freeze(["#0B3F3B", "#2563EB", "#7C3AED", "#DB2777", "#EA580C", "#0F766E"]);

export const SALLA_TEMPLATE_PREVIEW_GUIDANCE = Object.freeze({
  processing: "اربط القالب بحالة «قيد التنفيذ» الفعلية في متجرك قبل تشغيل الأتمتة.",
  under_review: "راجع اسم حالة المراجعة في سلة حتى لا تصل الرسالة قبل انتقال الطلب إليها فعلًا.",
  delivered: "تأكد من اعتماد حالة التسليم النهائية قبل طلب أي إجراء إضافي من العميل.",
  out_for_delivery: "تحقق من توفر بيانات شركة الشحن ورابط التتبع قبل بدء الإرسال التلقائي.",
  completed: "راجع اكتمال بيانات الطلب والرابط الآمن قبل اعتماد رسالة التنفيذ.",
  review_request: "اختر حالة بدء طلب التقييم والمهلة المناسبة لتجربة العميل في متجرك.",
  abandoned_cart: "اضبط مهلة التذكير بعناية، وتأكد من توقفه تلقائيًا عند إتمام الشراء.",
  cancelled: "راجع سياسة الإلغاء وسبب الإلغاء الظاهر للعميل قبل تفعيل القالب.",
  return_in_progress: "طابق حدث بدء الاسترجاع مع رحلة الإرجاع المعتمدة في متجرك.",
  returned: "تأكد من اكتمال بيانات المبلغ وطريقة الاسترداد قبل إرسال التأكيد.",
  shipped: "تحقق من رقم التتبع وشركة الشحن قبل اعتماد رسالة الشحن.",
  salla_invoice_ready: "تأكد من توفر الفاتورة ورابطها الآمن في بيانات سلة قبل تفعيل الإرسال."
});

export function sallaChannelReadiness(channel) {
  return channel === "email"
    ? "تأكد من اعتماد بريد المرسل قبل تفعيل الإرسال التلقائي."
    : "تأكد من اتصال جهاز واتساب قبل تفعيل الإرسال التلقائي.";
}

export function isSallaSecureLinkActive(settings = {}) {
  return settings.secureLinkEnabled === true && settings.secureLinkOptIn === true;
}
