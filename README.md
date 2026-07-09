# RenewPilot AI

واجهة SaaS عربية باتجاه RTL لإدارة الاشتراكات والتجديدات والتنبيهات ومركز الضمان والتحليلات.

## التشغيل المحلي

```bash
npm start
```

ثم افتح:

```txt
http://127.0.0.1:3000
```

## الصفحات

- الرئيسية
- المميزات
- الأسعار
- الدعم
- تسجيل الدخول
- لوحة التحكم
- الاشتراكات
- العملاء
- التجديدات
- التنبيهات
- المركز الضماني
- التقارير
- الإعدادات

الصور المرجعية موجودة داخل `public/references`.

## النشر على Vercel

Vercel يستخدم:

```bash
npm run build
```

ويخدم مخرجات `dist` مع fallback لمسارات التطبيق مثل `/login` و`/dashboard`.

## الربط الحقيقي

تمت إضافة بداية طبقة الربط الحقيقي:

- `.env.example` يحتوي متغيرات Neon وBetter Auth وWhapi وResend وMoyasar.
- `drizzle/0001_initial_schema.sql` يحتوي الجداول الأساسية والفهارس.
- `drizzle/0002_seed_platform_plans.sql` يحتوي باقات Trial وStarter وPro وBusiness.
- `drizzle/0003_cron_auth_safety.sql` يحتوي queue وtenant_members وإعدادات حماية واتساب.
- `api/cron/*` يحتوي مسارات Vercel Cron المحمية بـ `CRON_SECRET`.
