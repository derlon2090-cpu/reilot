# Production migration runbook

## التصميم

لا يشغّل Vercel build أو Docker web startup أي migration. يتم التنفيذ من Release/Pre-deploy job واحد يملك `DATABASE_URL`، بينما يمنع PostgreSQL advisory lock أي job ثانٍ من تعديل المخطط بالتزامن.

التسلسل الإلزامي:

```text
validate files/env
→ acquire session advisory lock
→ apply each migration in its own transaction
→ verify the complete migration ledger and checksums
→ release lock
→ verify auth schema/readiness
→ deploy or shift traffic
```

## تنفيذ الإصدار

اضبط في بيئة الـmigration job فقط:

```ini
RUN_DB_MIGRATIONS=true
MIGRATION_RELEASE_ID=<git-sha-or-release-id>
MIGRATION_LOCK_TIMEOUT_MS=60000
DATABASE_URL=<production-database-url>
DATABASE_SSL=true
```

ثم نفّذ:

```bash
npm ci
npm run db:migrate:production
npm run db:verify-auth-schema
```

لا تضبط `RUN_DB_MIGRATIONS=true` على Vercel build أو Render web service. يبدأ التطبيق عبر `node server.js` فقط.

## قواعد التغيير

- migrations السابقة immutable؛ checksum مختلف يوقف الإصدار.
- استخدم expand/contract: أضف أعمدة/جداول متوافقة أولًا، انشر الكود، ثم نفّذ contract في إصدار مستقل بعد التحقق.
- لا تخلط backfill كبيرًا مع DDL. استخدم job قابلًا للاستئناف ومفتاح idempotency.
- فشل migration يعمل `ROLLBACK` للملف الحالي، يفك القفل، ويوقف النشر.

## Rollback

1. لا تحذف سجل migration ولا تعدّل ملف migration مطبقًا.
2. أوقف تحويل الترافيك إلى الإصدار الجديد.
3. أعد نشر آخر إصدار متوافق؛ migration `0091` توسعية ويستطيع الكود السابق تجاهل جداولها.
4. إذا احتاج المخطط تصحيحًا، أنشئ migration forward-fix جديدة. لا تنفذ `DROP` يدويًا أثناء الحادث.
5. تحقق من `/api/readiness` ومن `npm run db:verify-auth-schema` قبل استعادة الترافيك.

## Health gate

لا يعتبر نجاح أمر migration وحده نجاح نشر. يجب نجاح فحص مخطط المصادقة، readiness، ثم smoke test لتسجيل دخول العميل والأدمن قبل اكتمال الإصدار.
