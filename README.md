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

## البناء المحلي

```bash
npm run build
```

ينتج ملفات static داخل `dist` للاختبار المحلي.

## النشر على Vercel

Vercel يخدم:

- `index.html` من جذر المشروع.
- ملفات الواجهة من `public/app`.
- الصور من `public/references`.
- وظائف cron من `api/cron`.

وتتم إعادة كتابة مسارات الواجهة مثل `/login` و`/dashboard` إلى `index.html`.

## الربط الحقيقي

تمت إضافة بداية طبقة الربط الحقيقي:

- `.env.example` يحتوي متغيرات Neon وBetter Auth وWhapi وResend وMoyasar.
- `drizzle/0001_initial_schema.sql` يحتوي الجداول الأساسية والفهارس.
- `drizzle/0002_seed_platform_plans.sql` يحتوي باقات Trial وStarter وPro وBusiness.
- `drizzle/0003_cron_auth_safety.sql` يحتوي queue وtenant_members وإعدادات حماية واتساب.
- `api/cron/*` يحتوي مسارات Vercel Cron المحمية بـ `CRON_SECRET`.
