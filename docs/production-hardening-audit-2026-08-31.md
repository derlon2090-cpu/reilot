# Renvix Technical Hardening Audit — 2026-08-31

## النطاق وطريقة الفحص

هذه الجولة هي المرحلة الأولى فقط من برنامج التحصين: **Repository Audit → Architecture Map → Threat Model → P0 Findings → P0 Implementation**. لم يتم تنفيذ أعمال Queue/Redis/Observability أو إعادة هيكلة واسعة.

تمت مراجعة بنية المشروع ومسارات المصادقة والجلسات والكوكيز وصلاحيات الإدارة وMiddleware وواجهات API والوصول إلى PostgreSQL وملفات migrations وWebhooks والتكاملات والمهام الخلفية والتخزين ومتغيرات البيئة وCORS/CSRF وRate Limiting والأسرار والاختبارات ومسار النشر.

حجم السطح الذي تمت مراجعته ساكنًا:

- 271 ملف API route، منها 37 لمسارات الإدارة، و6 Webhooks، و12 Cron routes.
- 94 وحدة خادمية و91 migration SQL.
- 162 اختبار Unit، و22 Integration، و18 Security، و5 Cron.

## Architecture Map الحالية

```text
Cloudflare DNS/WAF/Access
  ├─ renvix.app              → Vercel / Next.js public UI
  ├─ accounts.renvix.app     → Vercel auth UI → Render auth API
  ├─ dash.renvix.app         → Vercel customer UI → Render API
  ├─ wa-admin.renvix.app     → Cloudflare Access → Vercel admin UI → Render admin API
  └─ api.renvix.app          → Render / Next.js API backend

Render backend
  ├─ PostgreSQL (source of truth)
  ├─ DB-backed customer/admin sessions
  ├─ server-side tenant scoping and admin RBAC
  ├─ database-backed queues/idempotency in selected modules
  └─ external providers: Salla, Evolution/Meta, Resend, Moyasar, DeepSeek/Gemini, R2/Blob
```

النمط الحالي هو Modular Monolith عملي، وليس Microservices. هذا مناسب للمرحلة الحالية، ولا توجد فائدة تبرر تقسيمه الآن.

## Trust Boundaries وThreat Model

الأصول الحساسة: جلسات العملاء والأدمن، بيانات المستأجرين، مفاتيح التكاملات، بيانات الفوترة، الرسائل والملفات، وسجل التدقيق.

حدود الثقة الرئيسية:

1. المتصفح ↔ Cloudflare/Vercel.
2. Vercel ↔ Render عبر `api.renvix.app`.
3. Render ↔ PostgreSQL والتخزين ومزودي الطرف الثالث.
4. Webhook provider ↔ public webhook endpoint.
5. Tenant ↔ Tenant آخر.
6. Customer identity ↔ Admin control-plane identity.

أهم سيناريوهات التهديد التي راجعها هذا التدقيق: الوصول للإدارة من host غير رسمي، تجاوز Cloudflare Access، استخدام customer cookie كجلسة أدمن، open redirect، سرقة/تثبيت session، CSRF بين subdomains، IDOR بين المستأجرين، replay/duplicate webhooks، تسريب secrets، وتزامن migrations.

## النتائج حسب الأولوية

### P0 — Critical (أُغلقت في هذه الجولة)

#### P0-01: الدومين الإداري القديم ما زال في إعدادات الإنتاج

- الخطر: توجيه المستخدم أو callback إلى control plane غير الرسمي وإتاحة سطح إداري على deployment/host غير مقصود.
- الإصلاح: اعتماد `https://wa-admin.renvix.app` في أمثلة البيئة وVercel config والاختبارات، وتحويل المسارات الإدارية من hosts الرسمية المعروفة فقط. النطاق المتقاعد `wa.admin.renvix.app` والنطاق المحجوز `admin.renvix.app` و`*.vercel.app` تعيد صفحة 404 فارغة بلا تحويل أو كشف للنطاق الحقيقي. Admin APIs الخاطئة تعيد 404 ولا تُحوّل.

#### P0-02: Cloudflare Access لم يكن مُتحققًا منه داخل طبقة Vercel

- الخطر: الاعتماد على إعداد Cloudflare الخارجي وحده دون تحقق application-side من توقيع Access token و`iss/aud/exp`.
- الإصلاح: التحقق من `Cf-Access-Jwt-Assertion` باستخدام JWKS الرسمي، وخوارزمية `RS256`، وissuer الخاص بالفريق، وApplication AUD، ومدة الصلاحية. عند غياب الإعداد أو فشل التحقق يُغلق admin surface بـ403/503 قبل فحص جلسة Renvix.
- يطبق التحقق على Vercel فقط. Render لا يعتمد على Cloudflare JWT ويبقي `Admin session + RBAC` مستقلين.

#### P0-03: احتمال عبور Cloudflare assertion إلى Render

- الخطر: توسيع نطاق توكن البوابة إلى طبقة لا تحتاجه وإغراء الباكند بالاعتماد عليه مستقبلًا.
- الإصلاح: حذف `cf-access-jwt-assertion` من headers المنقولة إلى Render ومن request override بعد اجتياز بوابة Vercel.

### P1 — High (لم تُنفذ في هذه الجولة)

1. **Deployment migrations:** `vercel.json` و`prebuild` وDocker startup يمكنها تشغيل migrations أثناء deploy، وmigration runner لا يأخذ advisory lock شاملًا. يلزم فصل migration job وإضافة lock والتحقق/health gate.
2. **CSRF consistency:** توجد حماية Origin جيدة في مسارات كثيرة، لكن التطبيق يستخدم أكثر من helper وبسياسات مختلفة، وبعض mutations تعتمد على SameSite أو route-specific checks. يلزم توحيد policy واختبار كل cookie-authenticated mutation.
3. **Session rotation:** تغيير كلمة المرور يلغي الجلسات الأخرى، لكنه يبقي token الجلسة الحالية بدل تدويره. يلزم rotation ذري بعد password/MFA/privilege elevation مع اختبارات logout/invalidation.
4. **Tenant isolation defense-in-depth:** الاستعلامات الأساسية tenant-scoped وتوجد اختبارات عزل، لكن لا توجد PostgreSQL RLS. يلزم جرد query-by-query ثم دراسة RLS أو repository boundary موحدة دون refactor ضخم.
5. **Central rate limiting:** توجد حدود DB/ad-hoc وقيود موضعية، مع memory-only في أجزاء محدودة. يلزم policy مركزية موزعة قبل التوسع الأفقي.
6. **CI security gates:** لا توجد workflows متعقبة لـCodeQL/dependency review/secret scanner/status checks. اختبار الأسرار الحالي يفحص redaction وغياب `.env` فقط، وليس تاريخ/محتوى المستودع كاملًا.
7. **Audit schema:** سجل الأدمن موجود وغير قابل للتعديل من المستخدم العادي، لكنه يحتاج `request_id`, `tenant_id`, `resource_id` موحدة وسياسة retention/immutability.
8. **Backup/restore evidence:** لا يوجد في المستودع Runbook مثبت لـPITR/RPO/RTO واختبار restore دوري. يلزم إثبات من مزود PostgreSQL واختبار استعادة فعلي، لا مجرد تفعيل backup.

### P2 — Medium (مؤجلة)

1. توحيد structured JSON logging وcorrelation IDs في كل الطبقات، ثم Sentry/OpenTelemetry وmetrics/alerts.
2. توحيد provider timeout/retry/error taxonomy/circuit breaker؛ توجد timeouts وretry logic جزئيًا وليست policy عامة.
3. فصل تشغيل العمال عن HTTP بصورة كاملة؛ توجد DB queues/idempotency في أجزاء، لكن بعض workers ما زالت تُحفّز من request/cron.
4. توحيد أخطاء API حول envelope واحد مع نشر OpenAPI وخطة deprecation للواجهات القديمة؛ `/v1` موجود جزئيًا.
5. Runbooks للنشر التدريجي والrollback وstaging smoke tests.

### P3 — Nice to have (مؤجلة)

1. قياس bundle/query latency وN+1 قبل أي تحسينات cache.
2. توثيق ownership وحدود modules وتقليل cross-module imports تدريجيًا.
3. SLO dashboards بعد توفر قياسات فعلية؛ لا يمكن ادعاء 99.9% أو p95 قبل telemetry.

## ضوابط جيدة موجودة حاليًا

- customer session وadmin session منفصلتان؛ admin cookie Host-only و`HttpOnly; Secure; SameSite=Strict`.
- صلاحيات الأدمن تُفحص Server-side من `admin_users` و`admin_permissions`، وليست إخفاء UI فقط.
- `returnTo` محصور في relative paths ويمنع protocol-relative/open redirects.
- CORS مع credentials يستخدم allowlist ولا يستخدم wildcard.
- CSP/HSTS/nosniff/referrer/permissions/frame protections موجودة.
- Webhooks الرئيسية تملك signature/secret checks، وعدة مسارات تستخدم event IDs وunique idempotency keys.
- PostgreSQL هو source of truth، وتوجد معاملات وadvisory locks لعمليات مالية/حصص/OTP/حملات حساسة.
- `/health` و`/readiness` موجودان ولا يعيدان قيم الأسرار.

## تغييرات P0 في هذه الجولة

- لا توجد DB migrations.
- dependency مضافة مباشرة: `jose` للتحقق القياسي من JWT/JWKS في Edge runtime.
- متغيرات Vercel المطلوبة:
  - `NEXT_PUBLIC_ADMIN_URL=https://wa-admin.renvix.app`
  - `ADMIN_URL=https://wa-admin.renvix.app`
  - `CLOUDFLARE_ACCESS_TEAM_DOMAIN=aged-base-982a.cloudflareaccess.com`
  - `CLOUDFLARE_ACCESS_AUD=<Cloudflare Access Application Audience Tag>`
- لا تغير: site/auth/app/API URLs أو `AUTH_COOKIE_DOMAIN=.renvix.app` أو `COOKIE_SECURE=true`.

### الملفات المعدلة

- حدود التشغيل والأمان: `middleware.js`, `src/shared/cloudflare-access.js`, `src/shared/auth-backend-proxy.js`.
- الإعدادات والاعتمادات: `.env.example`, `.env.production.example`, `vercel.json`, `package.json`, `package-lock.json`.
- اختبارات P0 المباشرة: `tests/unit/cloudflare-access.test.ts`, `tests/unit/domain-middleware.test.ts`, `tests/unit/auth-backend-proxy.test.ts`, `tests/unit/auth-portal-routing.test.ts`, `tests/unit/app-url.test.ts`, `tests/unit/admin-session-redirect.test.ts`, `tests/unit/admin-server-authorization.test.ts`.
- إصلاح fixtures/توقعات قديمة كشفتها المجموعة الكاملة، دون تغيير UI أو Business Logic: `tests/integration/google-auth-intent-route.test.ts`, `tests/unit/ai-frontend-gateway.test.ts`, `tests/unit/google-config-route.test.ts`, `tests/unit/home-hero-metrics-strip.test.ts`, `tests/unit/ipad-public-header.test.ts`, `tests/unit/public-page-cleanup-and-pricing-comparison.test.ts`, `tests/unit/public-plans-resilience.test.ts`, `tests/unit/templates-catalog-ui.test.ts`, `tests/unit/unified-email-ai-editor.test.ts`.
- تقرير التدقيق: `docs/production-hardening-audit-2026-08-31.md`.

### نتائج التحقق النهائية

- `npm run lint`: ناجح، 0 أخطاء و68 تحذيرًا سابقًا غير مانع.
- `npm run typecheck`: ناجح.
- `npm run test:unit`: ‏162 ملفًا، 978 اختبارًا ناجحًا.
- `npm run test:integration`: ‏22 ملفًا، 71 اختبارًا ناجحًا.
- `npm run test:security`: ‏18 ملفًا، 54 اختبارًا ناجحًا.
- `npm run build`: ناجح باستخدام نطاقات الإنتاج النهائية، مع توليد 167/167 صفحة ثابتة. لا توجد migration نُفذت أثناء البناء المحلي.

### مراجع النطاقات الإدارية المتقاعدة

- لا يوجد أي مرجع متبقٍ إلى `wa.admin.renvix.app` في إعدادات التطبيق أو الكود؛ ظهوره الوحيد مقصود داخل اختبار الرفض وهذا التقرير لتوثيق النطاق المتقاعد.
- `admin.renvix.app` يظهر فقط في اختبارات الرفض وهذا التقرير بوصفه نطاقًا محجوزًا. لا يوجد Redirect منه ولا إعداد يعتبره نطاق الإدارة الحقيقي.

## Rollback لهذه المجموعة

1. ارجع commit الخاص بهذه المجموعة فقط.
2. أعد `NEXT_PUBLIC_ADMIN_URL` و`ADMIN_URL` إلى قيمة deployment السابقة إذا كان rollback تشغيليًا اضطراريًا.
3. لا توجد migration أو data mutation تحتاج rollback.
4. لا تحذف Cloudflare Access application أثناء rollback؛ يمكن إبقاء طبقته الخارجية فعالة.

## البوابة التالية

لا يبدأ P1 قبل مراجعة هذا التقرير واعتماد ترتيب: migration safety، ثم CSRF/session rotation، ثم tenant isolation وrate limiting وCI/backup evidence. Queue/Redis/Observability تبقى خارج هذه المرحلة كما طُلب.
