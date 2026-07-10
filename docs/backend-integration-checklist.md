# RenewPilot AI Backend Integration Checklist

## Cron Jobs

- `GET /api/cron/renewal-reminders`
  - يتحقق من `Authorization: Bearer CRON_SECRET`.
  - لا يرسل مباشرة، بل ينشئ عناصر `message_queue`.
  - نوافذ التجديد: بعد 7 أيام، بعد 3 أيام، بعد يوم، اليوم، قبل يوم، قبل 3 أيام.

- `GET /api/cron/message-retry`
  - يعالج `pending` فقط.
  - حد التشغيل: 20 رسالة لكل tenant في الدورة.
  - يطبق حدود الباقة، حدود اليوم/الساعة، quiet hours، unsubscribe، التكرار، وrisk score.

- `GET /api/cron/whatsapp-health-check`
  - يفحص القنوات المتصلة على دفعات 50.
  - يحدث `last_health_check_at`, `status`, `last_error`.

- `GET /api/cron/usage-reset`
  - ينشئ سجل `message_usage` للشهر الجديد حسب باقة tenant.
  - لا يحذف السجلات القديمة.

- `GET /api/cron/cleanup`
  - ينظف QR cache القديم، الجلسات المنتهية، والسجلات المؤقتة.

## Auth And Tenant Rules

- كل dashboard/API يحتاج session صالحة.
- استخراج `tenant_id` يتم من `tenant_members`.
- كل مورد يجب أن يثبت ملكيته لنفس tenant.
- محاولة الوصول لمورد tenant آخر ترجع `403`.
- بعد 5 محاولات دخول فاشلة، يتم حظر المحاولة لمدة 15 دقيقة.

## WhatsApp Safety

- لا إرسال إذا القناة disconnected.
- لا إرسال إذا تجاوز المستخدم حد الرسائل الشهري.
- لا إرسال إذا تجاوز الحد اليومي أو الساعي.
- لا إرسال داخل quiet hours.
- لا إرسال للأرقام الموجودة في `unsubscribe_list`.
- لا تكرار لنفس الرسالة داخل نافذة 24 ساعة.
- إذا risk score تجاوز 70، يتم إيقاف الإرسال التلقائي مؤقتًا.

## Evolution API Self-Hosted

- `WHATSAPP_PROVIDER=evolution`.
- `EVOLUTION_API_URL` يعمل عبر HTTPS reverse proxy.
- `EVOLUTION_API_KEY` يستخدم في الباكند فقط.
- Port 8080 غير مكشوف للعامة.
- كل tenant يملك Evolution instance منفصلة.
- QR cache لا يحتوي مفاتيح أو tokens خام.

## Production Secrets

- `EVOLUTION_API_KEY` لا يظهر في الواجهة.
- `EVOLUTION_WEBHOOK_SECRET` لا يظهر في الواجهة.
- `DATABASE_URL` لا يظهر في الواجهة.
- instance token لا يظهر في أي response.
- instance token يجب حفظه مشفرًا باستخدام `ENCRYPTION_KEY`.
