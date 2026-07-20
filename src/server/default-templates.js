export const TEMPLATE_KEYS = Object.freeze({
  RENEWAL_WHATSAPP: "renewal_whatsapp",
  RENEWAL_EMAIL: "renewal_email",
  ORDER_INFORMATION_SALLA: "order_information_salla"
});

const DEFAULT_RENEWAL_TEMPLATES = [
  {
    key: TEMPLATE_KEYS.RENEWAL_WHATSAPP,
    channel: "whatsapp",
    name: "قالب تجديد الاشتراك — واتساب",
    title: null,
    body: "مرحبًا {{customer_name}}،\n\nنذكّرك بأن اشتراكك في {{service_name}} سينتهي بتاريخ {{expiry_date}}.\n\nيمكنك مراجعة خيارات التجديد من الرابط التالي:\n{{renewal_url}}"
  },
  {
    key: TEMPLATE_KEYS.RENEWAL_EMAIL,
    channel: "email",
    name: "قالب تجديد الاشتراك — البريد الإلكتروني",
    title: "تذكير بتجديد اشتراكك في {{service_name}}",
    body: "مرحبًا {{customer_name}}،\n\nنذكّرك بأن اشتراكك في {{service_name}} سينتهي بتاريخ {{expiry_date}}.\n\nيمكنك مراجعة خيارات التجديد من خلال الزر التالي."
  }
];

export async function ensureDefaultTemplates(client, tenantId, storeName = "Renvix Store") {
  for (const template of DEFAULT_RENEWAL_TEMPLATES) {
    await client.query(`INSERT INTO notification_templates
      (tenant_id,template_key,template_group,name,channel,trigger_type,title,body,variables,is_system_default,is_active)
      VALUES($1,$2,'renewal',$3,$4,'before_expiry',$5,$6,$7::jsonb,true,true)
      ON CONFLICT (tenant_id,template_key) DO NOTHING`, [tenantId, template.key, template.name,
      template.channel, template.title, template.body,
      JSON.stringify(["customer_name","service_name","expiry_date","days_remaining","renewal_url","store_name","order_number"])]);
  }
  await client.query(`INSERT INTO order_info_templates
    (tenant_id,template_key,template_group,name,style,theme_color,store_name,header_text,footer_text,
     additional_notes,visible_fields,is_default,is_active)
    VALUES($1,$2,'order_information','قالب معلومات الطلب — سلة','classic','#2563EB',$3,
      'معلومات طلبك أصبحت جاهزة','Renvix','[]'::jsonb,'{}'::jsonb,true,true)
    ON CONFLICT (tenant_id) DO NOTHING`, [tenantId, TEMPLATE_KEYS.ORDER_INFORMATION_SALLA, storeName]);
}
