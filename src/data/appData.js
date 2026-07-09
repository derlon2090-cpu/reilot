export const metrics = {
  dashboard: [
    { title: "الاشتراكات النشطة", value: "1,256", change: "+12%", tone: "success" },
    { title: "تنتهي قريبًا", value: "86", change: "خلال 7 أيام", tone: "warning" },
    { title: "التجديدات هذا الشهر", value: "324", change: "+18%", tone: "info" },
    { title: "التنبيهات المرسلة", value: "2,480", change: "+31%", tone: "success" },
    { title: "إجمالي الإيرادات", value: "184,250 ر.س", change: "+22%", tone: "purple" }
  ],
  subscriptions: [
    { title: "نشطة", value: "1,256", tone: "success" },
    { title: "موقوفة", value: "34", tone: "neutral" },
    { title: "متأخرة", value: "18", tone: "danger" },
    { title: "منتهية قريبًا", value: "86", tone: "warning" },
    { title: "تم تجديدها", value: "324", tone: "info" }
  ],
  customers: [
    { title: "إجمالي العملاء", value: "10,420", tone: "info" },
    { title: "العملاء النشطون", value: "8,930", tone: "success" },
    { title: "عملاء معرضون لعدم التجديد", value: "214", tone: "warning" },
    { title: "عملاء VIP", value: "642", tone: "purple" },
    { title: "تسجيلات جديدة", value: "128", tone: "success" }
  ],
  renewals: [
    { title: "تجديدات اليوم", value: "24", tone: "info" },
    { title: "خلال 3 أيام", value: "61", tone: "warning" },
    { title: "هذا الأسبوع", value: "186", tone: "success" },
    { title: "متأخرة", value: "18", tone: "danger" },
    { title: "الإيرادات المتوقعة", value: "72,900 ر.س", tone: "purple" }
  ],
  notifications: [
    { title: "تم إرسالها اليوم", value: "1,248", tone: "info" },
    { title: "قيد الانتظار", value: "124", tone: "warning" },
    { title: "تم التسليم", value: "1,092", tone: "success" },
    { title: "فشلت", value: "56", tone: "danger" },
    { title: "معدل النقر", value: "34.6%", tone: "purple" }
  ],
  warranty: [
    { title: "الحالات المفتوحة", value: "48", tone: "warning" },
    { title: "الحالات المحلولة", value: "312", tone: "success" },
    { title: "قيد المراجعة", value: "21", tone: "info" },
    { title: "طلبات الاستبدال", value: "13", tone: "danger" },
    { title: "متوسط وقت الحل", value: "6.4 ساعات", tone: "purple" }
  ],
  reports: [
    { title: "الإيرادات الشهرية", value: "184,250 ر.س", tone: "success" },
    { title: "معدل التجديد", value: "81.4%", tone: "info" },
    { title: "معدل الإلغاء", value: "3.8%", tone: "danger" },
    { title: "نمو العملاء", value: "+18%", tone: "purple" },
    { title: "أداء التنبيهات", value: "76%", tone: "warning" }
  ]
};

export const features = [
  ["تنبيهات واتساب تلقائية", "جدولة رسائل التجديد حسب تاريخ انتهاء كل اشتراك.", "و"],
  ["روابط تجديد ذكية", "روابط دفع وتجديد مخصصة لكل عميل مع تتبع النقرات.", "ر"],
  ["بوابة العملاء", "مساحة بسيطة للعميل لمراجعة الاشتراك والتجديد.", "ب"],
  ["اقتراحات بالذكاء الاصطناعي", "رسائل وتوصيات مبنية على حالة العميل وسجل التجديد.", "AI"],
  ["تحليلات وتقارير متقدمة", "لوحات إيرادات وتجديدات ومخاطر عدم التجديد.", "ت"],
  ["المركز الضماني", "متابعة حالات الضمان والاستبدال من نفس اللوحة.", "ض"],
  ["إدارة العملاء", "ملف موحد لكل عميل مع الاشتراكات والرسائل.", "ع"],
  ["التكاملات", "ربط البريد وواتساب والدفع وأنظمة المتجر.", "ك"],
  ["جدولة التنبيهات", "قواعد تلقائية قبل الانتهاء وبعده حسب الخطة.", "ج"],
  ["سجل النشاطات", "تتبع كل عملية إرسال وتجديد وتعديل في مكان واحد.", "س"]
];

export const pricingPlans = [
  { id: "starter", name: "Starter", monthly: 49, yearly: 39, caption: "للمتاجر الصغيرة", customers: "حتى 500 عميل", alerts: "2,000 تنبيه", features: ["تنبيهات بريدية", "لوحة اشتراكات", "تقارير أساسية", "دعم بالبريد"] },
  { id: "pro", name: "Pro", monthly: 99, yearly: 79, caption: "للنمو السريع", customers: "حتى 5,000 عميل", alerts: "20,000 تنبيه", features: ["تنبيهات واتساب", "بوابة العملاء", "ذكاء اصطناعي", "مركز ضمان"], featured: true },
  { id: "business", name: "Business", monthly: 179, yearly: 143, caption: "للفرق والعمليات", customers: "غير محدود", alerts: "غير محدود", features: ["API", "فرق وصلاحيات", "مدير حساب", "تقارير متقدمة"] }
];

export const subscriptions = [
  { order: "#RP-1048", customer: "سارة العتيبي", phone: "966501112233", service: "باقة العناية", plan: "Pro", start: "2026-06-01", end: "2026-07-14", status: "تنتهي قريبًا", renewal: "https://renewpilot.ai/pay/RP-1048" },
  { order: "#RP-1047", customer: "محمد الحربي", phone: "966555221100", service: "اشتراك شهري", plan: "Business", start: "2026-05-21", end: "2026-07-21", status: "نشط", renewal: "https://renewpilot.ai/pay/RP-1047" },
  { order: "#RP-1046", customer: "نورة السالم", phone: "966544778899", service: "ضمان ممتد", plan: "Starter", start: "2026-04-02", end: "2026-07-02", status: "متأخر", renewal: "https://renewpilot.ai/pay/RP-1046" },
  { order: "#RP-1045", customer: "خالد الزهراني", phone: "966533445566", service: "صيانة دورية", plan: "Pro", start: "2026-06-12", end: "2026-08-12", status: "تم التجديد", renewal: "https://renewpilot.ai/pay/RP-1045" },
  { order: "#RP-1044", customer: "ريم الغامدي", phone: "966500998877", service: "عضوية المتجر", plan: "Starter", start: "2026-05-05", end: "2026-07-30", status: "موقوف", renewal: "https://renewpilot.ai/pay/RP-1044" }
];

export const customers = [
  { name: "سارة العتيبي", email: "sara@example.com", phone: "966501112233", plan: "Pro", renewal: "2026-07-14", status: "تنتهي قريبًا", total: "8,420 ر.س", risk: "متوسط" },
  { name: "محمد الحربي", email: "mohammed@example.com", phone: "966555221100", plan: "Business", renewal: "2026-07-21", status: "نشط", total: "21,900 ر.س", risk: "منخفض" },
  { name: "نورة السالم", email: "nora@example.com", phone: "966544778899", plan: "Starter", renewal: "2026-07-02", status: "متأخر", total: "1,280 ر.س", risk: "مرتفع" },
  { name: "خالد الزهراني", email: "khaled@example.com", phone: "966533445566", plan: "Pro", renewal: "2026-08-12", status: "تم التجديد", total: "11,340 ر.س", risk: "منخفض" }
];

export const renewals = [
  { bucket: "اليوم", customer: "سارة العتيبي", service: "باقة العناية", amount: "399 ر.س", due: "2026-07-09" },
  { bucket: "اليوم", customer: "شركة مدار", service: "دعم شهري", amount: "1,200 ر.س", due: "2026-07-09" },
  { bucket: "خلال 3 أيام", customer: "محمد الحربي", service: "اشتراك Business", amount: "799 ر.س", due: "2026-07-12" },
  { bucket: "هذا الأسبوع", customer: "خالد الزهراني", service: "صيانة دورية", amount: "249 ر.س", due: "2026-07-15" },
  { bucket: "متأخر", customer: "نورة السالم", service: "ضمان ممتد", amount: "149 ر.س", due: "2026-07-02" }
];

export const notifications = [
  { channel: "واتساب", recipient: "سارة العتيبي", template: "تذكير قبل الانتهاء", status: "تم التسليم", time: "09:30 صباحًا" },
  { channel: "البريد الإلكتروني", recipient: "محمد الحربي", template: "رابط التجديد", status: "قيد الانتظار", time: "10:15 صباحًا" },
  { channel: "SMS", recipient: "نورة السالم", template: "متأخر عن التجديد", status: "فشلت", time: "11:00 صباحًا" },
  { channel: "واتساب", recipient: "خالد الزهراني", template: "تأكيد التجديد", status: "تم التسليم", time: "12:45 مساءً" }
];

export const warrantyCases = [
  { id: "WR-2201", customer: "عبدالله المطيري", service: "جهاز منزلي", issue: "استبدال", priority: "عالية", status: "قيد المراجعة", updated: "منذ 18 دقيقة" },
  { id: "WR-2200", customer: "ريم الغامدي", service: "ضمان ممتد", issue: "عطل متكرر", priority: "متوسطة", status: "مفتوحة", updated: "منذ ساعة" },
  { id: "WR-2199", customer: "فهد الدوسري", service: "صيانة", issue: "تأخير موعد", priority: "منخفضة", status: "محلولة", updated: "أمس" }
];

export const reports = {
  revenue: [36, 48, 52, 61, 77, 84, 96, 108],
  plans: [
    { name: "Starter", value: "34%", amount: "42,100 ر.س" },
    { name: "Pro", value: "48%", amount: "91,600 ر.س" },
    { name: "Business", value: "18%", amount: "50,550 ر.س" }
  ],
  insights: [
    "العملاء الذين تصلهم رسالة واتساب قبل 3 أيام يجددون بنسبة أعلى 24%.",
    "باقة Pro تحقق أعلى هامش نمو خلال هذا الشهر.",
    "أفضل وقت لإرسال روابط التجديد بين 10 صباحًا و1 ظهرًا."
  ]
};

export const knowledgeBase = ["البدء السريع", "إدارة الاشتراكات", "التكاملات والإعدادات", "الفوترة والدفع", "التقارير والتحليلات", "استكشاف الأخطاء"];
