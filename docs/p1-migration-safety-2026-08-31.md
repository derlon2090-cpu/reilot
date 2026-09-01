# Renvix P1 — Migration Safety

هذه الدفعة تنفذ بند P1 الأول فقط، إضافة إلى إصلاح Admin OTP routing وعزل `admin.renvix.app` كفخ أمني. لم تبدأ أعمال CSRF أو Session Rotation أو بقية P1/P2/P3.

## السبب السابق

- كان Vercel `buildCommand` و`prebuild` وDocker startup قادرين على تشغيل migrations مع كل نسخة ويب.
- مشغّل migrations لم يملك lock شاملًا، لذلك كان نشران متزامنان يستطيعان محاولة تطبيق الملف نفسه.
- سجل migrations اعتمد الاسم فقط ولم يكشف تعديل SQL مطبق سابقًا.

## التصميم الجديد

- build وweb startup لا يغيّران قاعدة البيانات.
- Release job صريح يتطلب `RUN_DB_MIGRATIONS=true` و`MIGRATION_RELEASE_ID`.
- PostgreSQL session advisory lock يغطي الإنشاء والتطبيق والتحقق، ويفك في `finally` عند النجاح أو الفشل.
- كل migration داخل transaction مستقلة، مع ledger checksum وتحقق نهائي قبل فك القفل.
- migrations الأمنية `0091_security_operations_center.sql` و`0092_honeypot_first_alerts.sql` توسعية؛ الثانية توسّع مستويات تنبيهات الفخ دون حذف أو إعادة كتابة بيانات قائمة.

## إصلاحات المصادقة والفخ الأمني

- Admin login ينتقل مباشرة إلى `/verify-email` أو `/verify-mfa` على `wa-admin.renvix.app`.
- legacy `/auth/verify-*` يتحول 307 إلى canonical على نفس admin host بعد Cloudflare Access.
- Admin OTP الناجح ينشئ `renvix_admin_session` فقط ويتجه إلى `/admin`؛ Customer OTP لم يتغير.
- `admin.renvix.app` يعمل أساسًا عبر Cloudflare Worker معزول، ويملك middleware طبقة احتياطية تعترض الـHost قبل أي routing، وباستجابة فارغة موحدة لكل path بما فيها assets.
- الأحداث الموقعة تنتقل إلى Render عبر Security Center الحالي دون Cookies/Authorization/query values، وتُجمع في Finding/Incident واحد حسب المصدر مع risk escalation.
- أول زيارة تنشئ Incident منخفض الخطورة وتنبيهًا فوريًا واحدًا؛ التكرار يُجمع، بينما تغيّر Severity أو انقضاء نافذة cooldown يسمح بتنبيه جديد.

## المخاطر المتبقية

- يلزم ضبط Release/Pre-deploy command في مزود الاستضافة؛ المستودع لا يستطيع تعديل إعداد Render/Vercel الخارجية تلقائيًا.
- البريد الفوري يعتمد على Resend وعلى وجود security admin نشط أو `SECURITY_ALERT_RECIPIENTS`.
- يجب ربط `admin.renvix.app` بالـCloudflare Worker المرفق؛ اعتراض Vercel احتياطي وليس بديلًا عن العزل على الحافة.
- Restore drill الفعلي مؤجل لبند Backup/Restore في P1 ولا يجوز اعتباره منجزًا من هذا التغيير.

## الملفات المعدلة

- Admin OTP/domain boundary: `src/components/admin-auth/AdminLoginForm.jsx`, `middleware.js`, `app/api/auth/email-otp/verify/route.js`, `app/api/admin/auth/login/route.js`.
- Honeypot/alerts: `deploy/cloudflare/admin-honeypot/src/worker.js`, `src/shared/admin-honeypot.js`, `src/server/security-center.js`, `app/api/security/ingest/honeypot/route.js`.
- Migration safety: `scripts/lib/migration-runner.mjs`, `scripts/migrate.mjs`, `scripts/migrate-production.mjs`, `scripts/migrate-on-production-build.mjs`, `package.json`, `vercel.json`, `Dockerfile`.
- Schema: `drizzle/0091_security_operations_center.sql`, `drizzle/0092_honeypot_first_alerts.sql`.
- Configuration/runbook: `.env.example`, `.env.production.example`, `README.md`, `docs/runbooks/production-migrations.md`.
- Tests: `tests/unit/admin-otp-routing.test.ts`, `tests/unit/admin-honeypot.test.ts`, `tests/unit/migration-runner.test.ts`, `tests/unit/domain-middleware.test.ts`.

## Environment Variables

على Cloudflare Worker وVercel وRender بالقيمة نفسها، دون `NEXT_PUBLIC_*`:

```ini
HONEYPOT_INGESTION_SECRET=<independent-long-random-secret>
```

مستلمو التنبيه الاختياريون على Render:

```ini
SECURITY_ALERT_RECIPIENTS=security@example.com
```

على migration job فقط:

```ini
RUN_DB_MIGRATIONS=true
MIGRATION_RELEASE_ID=<git-sha-or-release-id>
MIGRATION_LOCK_TIMEOUT_MS=60000
```

## نتائج التحقق

- `npm run lint`: ناجح، 0 أخطاء و68 تحذيرًا سابقًا.
- ESLint المستهدف لملفات الأمان والترحيل: ناجح دون أخطاء أو تحذيرات.
- `npm run typecheck`: ناجح.
- `npm run test:unit`: ‏166 ملفًا و1000 اختبار ناجح.
- `npm run test:integration`: ‏22 ملفًا و71 اختبارًا ناجحًا.
- `npm run test:security`: ‏19 ملفًا و59 اختبارًا ناجحًا.
- `npm run build`: ناجح، 169/169 صفحة ثابتة، دون `DATABASE_URL` أو تشغيل migrations.

## Rollback

1. أوقف تحويل الترافيك للإصدار الجديد وأعد نشر commit السابق المتوافق.
2. لا تحذف `0091` أو `0092` ولا جداول الحوادث أثناء rollback؛ التغييرات توسعية والكود السابق يتجاهلها.
3. عطّل ingest بإزالة route/Worker binding بدل كشف أو تدوين السر؛ سيظل الرد المحايد يعمل لكن التسجيل سيتوقف، لذلك استخدم ذلك كإجراء حادث مؤقت فقط.
4. لا تُرجع migrations إلى build/startup. أي تصحيح مخطط يجب أن يكون forward-fix migration جديدة.
