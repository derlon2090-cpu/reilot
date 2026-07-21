export const TEMPLATE_KEYS = Object.freeze({
  WHATSAPP_MENU: "whatsapp_menu",
  EMAIL_DELIVERY: "email_delivery",
  RENEWAL_WHATSAPP: "renewal_whatsapp",
  RENEWAL_EMAIL: "renewal_email",
  SALLA_FULFILLED: "salla_fulfilled",
  ORDER_INFORMATION_SALLA: "order_information_salla"
});

const DEFAULT_MESSAGE_TEMPLATES = [
  {
    key: TEMPLATE_KEYS.WHATSAPP_MENU,
    group: "whatsapp_menu",
    channel: "whatsapp",
    trigger: "manual",
    name: "قائمة واتساب",
    title: null,
    body: "مرحبًا {{customer_name}}،\n\nاختر الخدمة التي تحتاجها من القائمة التالية.",
    buttonLabel: "عرض القائمة",
    footerText: "Renvix",
    contentJson: {
      sections: [{
        title: "الخدمات",
        rows: [
          { id: "subscriptions", title: "اشتراكاتي", description: "عرض الاشتراكات الحالية" },
          { id: "renewal", title: "التجديد", description: "مراجعة خيارات التجديد" },
          { id: "support", title: "الدعم", description: "التواصل مع فريق الدعم" }
        ]
      }]
    },
    variables: ["customer_name", "store_name"]
  },
  {
    key: TEMPLATE_KEYS.EMAIL_DELIVERY,
    group: "order_delivery",
    channel: "email",
    trigger: "order_information",
    name: "قالب قناة إرسال بريد",
    title: "معلومات طلبك رقم {{order_number}} جاهزة",
    body: "مرحبًا {{customer_name}}،\n\nتم تجهيز معلومات طلبك رقم {{order_number}} ويمكنك مراجعة التفاصيل من الزر التالي.",
    buttonLabel: "عرض معلومات الطلب",
    footerText: "شكرًا لاختيارك {{store_name}}",
    contentJson: {},
    variables: ["customer_name", "order_number", "order_portal_url", "store_name"]
  },
  {
    key: TEMPLATE_KEYS.RENEWAL_WHATSAPP,
    group: "renewal",
    channel: "whatsapp",
    trigger: "before_expiry",
    name: "قالب تجديد الاشتراك — واتساب",
    title: null,
    body: "مرحبًا {{customer_name}}،\n\nنذكّرك بأن اشتراكك في {{service_name}} سينتهي بتاريخ {{expiry_date}}.\n\nيمكنك مراجعة خيارات التجديد من الرابط التالي:\n{{renewal_url}}",
    buttonLabel: null,
    footerText: null,
    contentJson: {},
    variables: ["customer_name", "service_name", "expiry_date", "days_remaining", "renewal_url", "store_name", "order_number"]
  },
  {
    key: TEMPLATE_KEYS.RENEWAL_EMAIL,
    group: "renewal",
    channel: "email",
    trigger: "before_expiry",
    name: "قالب تجديد الاشتراك — البريد الإلكتروني",
    title: "تذكير بتجديد اشتراكك في {{service_name}}",
    body: "مرحبًا {{customer_name}}،\n\nنذكّرك بأن اشتراكك في {{service_name}} سينتهي بتاريخ {{expiry_date}}.\n\nيمكنك مراجعة خيارات التجديد من خلال الزر التالي.",
    buttonLabel: "جدد اشتراكك الآن",
    footerText: "شكرًا لثقتك بنا",
    contentJson: {},
    variables: ["customer_name", "service_name", "expiry_date", "days_remaining", "renewal_url", "store_name", "order_number"]
  },
  {
    key: TEMPLATE_KEYS.SALLA_FULFILLED,
    group: "salla_fulfillment",
    channel: "whatsapp",
    trigger: "order_fulfilled",
    name: "قالب تم التنفيذ — سلة",
    title: null,
    body: "مرحبًا {{customer_name}}،\n\nتم تجهيز معلومات طلبك رقم {{order_number}}.\n\nيمكنك مراجعة تفاصيل الطلب من الرابط التالي:",
    buttonLabel: "عرض معلومات الطلب",
    footerText: "Renvix",
    contentJson: { lockedPortalLink: true },
    variables: ["customer_name", "order_number", "order_portal_url", "store_name"]
  }
];

export async function ensureDefaultTemplates(client, tenantId, storeName = "Renvix Store") {
  for (const template of DEFAULT_MESSAGE_TEMPLATES) {
    await client.query(`INSERT INTO notification_templates
      (tenant_id,template_key,template_group,name,channel,trigger_type,title,body,variables,
       content_json,button_label,footer_text,is_system_default,is_active)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12,true,true)
      ON CONFLICT (tenant_id,template_key) DO NOTHING`, [tenantId, template.key, template.group,
      template.name, template.channel, template.trigger, template.title, template.body,
      JSON.stringify(template.variables), JSON.stringify(template.contentJson || {}), template.buttonLabel, template.footerText]);
  }
  await client.query(`INSERT INTO order_info_templates
    (tenant_id,template_key,template_group,name,style,theme_color,store_name,header_text,footer_text,
     additional_notes,visible_fields,is_default,is_active)
    VALUES($1,$2,'order_information','قالب معلومات الطلب — سلة','classic','#2563EB',$3,
      'معلومات طلبك أصبحت جاهزة','Renvix','[]'::jsonb,'{}'::jsonb,true,true)
    ON CONFLICT (tenant_id) DO NOTHING`, [tenantId, TEMPLATE_KEYS.ORDER_INFORMATION_SALLA, storeName]);
}
