# RenewPilot AI

واجهة SaaS عربية باتجاه RTL لإدارة الاشتراكات والتجديدات والتنبيهات ومركز الضمان والتحليلات.

## التشغيل المحلي

```bash
npm run dev
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

يبني تطبيق Next.js للنشر.

## النشر على Vercel

Vercel يخدم:

- تطبيق Next.js من مجلد `app`.
- ملفات الواجهة من `public/app`.
- الصور من `public/references`.
- وظائف cron من `app/api/cron`.

وتتم معالجة مسارات الواجهة مثل `/login` و`/dashboard` عبر catch-all page.

ملاحظة Vercel Hobby: جداول cron مضبوطة بتكرار يومي حتى ينجح النشر على خطة Hobby. للتشغيل كل ساعة أو كل دقيقة، يلزم ترقية المشروع إلى Vercel Pro ثم تعديل `vercel.json`.

## الربط الحقيقي

تمت إضافة بداية طبقة الربط الحقيقي:

- `.env.example` يحتوي متغيرات Neon وBetter Auth وEvolution API self-hosted وResend وMoyasar.
- `drizzle/0001_initial_schema.sql` يحتوي الجداول الأساسية والفهارس.
- `drizzle/0002_seed_platform_plans.sql` يحتوي باقات Trial وStarter وPro وBusiness.
- `drizzle/0003_cron_auth_safety.sql` يحتوي queue وtenant_members وإعدادات حماية واتساب.
- `app/api/cron/*` يحتوي مسارات Vercel Cron المحمية بـ `CRON_SECRET`.
