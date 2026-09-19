# Security review — 2026-09-18

تم إصلاح ثغرات مؤكدة في النسخة المحلية: عزل بيانات العملاء، خصوصية مرفقات الدعم، كشف تفاصيل الخدمات، طلبات الويب الخارجية، والتحقق من مصدر الطلبات. لم تُنشر التغييرات ولم تُطبّق قواعد جدار الحماية على السيرفر الفعلي لعدم توفر الوصول إليه. الأولوية: نشر الإصلاحات مع إعدادات الإنتاج الصحيحة، ثم نقل مرفقات الدعم القديمة وحذف روابطها العامة. نتيجة المراجعة ليست ضماناً بخلو النظام من جميع الثغرات.

Status: fixes uploaded to draft PR #58 on branch `codex/security-hardening-20260919`; production deployment, database migrations, firewall installation and Cloudflare API changes have NOT been executed. No deployment or server credentials were available in this workspace.

## Scope and confirmed fixes

Reviewed application authentication/session boundaries, administration middleware, tenant ownership, upload/download storage, webhook network requests, health responses, preview server file serving, database TLS and dependency advisories. Inventoried 332 Next.js route handlers and their guards/delegations. This is a source review and selected regression testing, not proof that every vulnerability has been eliminated or a complete authenticated production penetration test.

| Finding | Change |
| --- | --- |
| Client-supplied tenant ID could replace authenticated tenant in order-link profile updates | Apply authenticated tenant last; regression test covers attempted replacement. Apply the same construction to contact creation. |
| Payment links could reference customer/subscription records outside the authenticated tenant | Validate UUIDs and resolve both references within the session tenant before writes. |
| Support attachments uploaded to public Blob storage | New uploads use private R2 objects. Downloads require ticket ownership or support-read admin permission, exclude internal notes for users and use attachment/no-store headers. APIs expose authenticated download routes rather than storage URLs. |
| Anonymous health endpoint exposed service configuration/readiness details | Public response contains only `ok`; detailed monitoring requires a server-only, constant-time checked bearer token of at least 32 characters. |
| Custom webhook SSRF protection could be bypassed through a second DNS lookup | Resolve and validate all addresses, reject non-public IPv4/IPv6, pin HTTPS socket lookup to an approved address while preserving hostname certificate validation, prohibit redirects and retain bounded reads/timeouts. |
| Browser mutations lacked a shared origin boundary | Guard session/admin entry points, authentication mutations and middleware. Reject foreign origins and cross-site fetch metadata; use explicitly configured trusted app origins rather than forwarded-host headers. |
| Alternate frontend host could evade Cloudflare Access middleware | Enforce Access for production admin surfaces except the explicitly configured canonical backend API. Backend session/RBAC checks remain required. |
| AI gateway path normalization could leave its intended namespace | Reject empty, dot, encoded and separator-bearing path segments before upstream requests. |
| Development preview server served repository-root files | Confine allowed assets by canonical real path, reject hidden/sensitive files and traversal, restrict methods, bind loopback by default, refuse production startup. |
| Production authentication could treat incomplete database schema as active/MFA-disabled | Fail closed for missing security/account-state columns. Production requires the second factor even if an optional flag is false. |
| PostgreSQL certificate verification was disabled | Verify certificates, remove URL SSL parameters that can override the TLS object and support an explicit private-network non-TLS exception/CA configuration. |
| Production migration, admin bootstrap and schema verification scripts still disabled PostgreSQL certificate checks | Reuse the same verified database connection policy as the application; update the migration GitHub Action from Node 20 to the required Node 22 runtime. |
| Secrets could appear in diagnostic values or serialized objects | Redact configured secret values and additional credential field names; exclude local artifacts/logs/worktrees from Docker context. |
| Known dependency vulnerabilities | Next.js 15.5.25, sharp override 0.35.4, js-yaml override 4.3.2 and Vitest 4.1.11. Require Node >=22.12.0; validation used Node 24.19.0. |

Dependency references: [Next.js advisory](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36), [Next.js advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4), [sharp advisory](https://github.com/lovell/sharp/security/advisories/GHSA-rgj7-g3m4-5g8c).

## Production actions required

1. Prepare deployment on staging with the real server-only secrets and configured site/auth/dashboard/admin/API origins. Check database CA trust; use `DATABASE_SSL=false` only for an intentionally isolated private-network database. Verify authentication schema migrations and configured OTP/TOTP delivery before rollout. Missing production second-factor configuration intentionally denies login rather than creating a password-only session.
2. Configure private R2 storage (`R2_ACCOUNT_ID` or `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`). Disable public bucket access and public/custom-domain object access. New support uploads intentionally fail when private storage is unavailable.
3. Run `node scripts/migrate-support-attachments-private.mjs` in a dedicated production job with database, R2 and `BLOB_READ_WRITE_TOKEN` credentials. It verifies size/hash and the private copy before updating the DB and deleting old public blobs; its owner-only `.local` journal supports resuming deletions. **Old Blob URLs remain public until migration and deletion complete.** Preserve backups privately and verify an old URL no longer downloads without credentials.
4. Deploy the app fix, configure a random server-only `HEALTH_CHECK_TOKEN` and update monitoring bearer headers. Do not expose this token through `NEXT_PUBLIC_*` variables. Verify anonymous health output contains only `ok`; investigate the existing production 503 from internal diagnostics.
5. Follow `HARDENED-DEPLOYMENT.md` for Cloudflare-only origin ingress, private app/database ports, Nginx probe closure and edge banning. Determine the actual public NICs, both IPv4 and IPv6, and test restore on reboot. These controls are prepared but are not installed on the production host.
6. Keep admin behind Cloudflare Access with a restrictive identity policy. The canonical API still provides session/RBAC-protected admin endpoints: if it must also be inaccessible outside Access/VPN, add an API Access application or private ingress with service authentication for trusted frontend-to-backend calls. Confirm no provider hostname bypass.

Cloudflare WAF Block acts on HTTP after edge TLS negotiation; it cannot guarantee that a blocked client fails the edge TLS handshake. Kernel DROP on a directly reached origin prevents that handshake. Nginx 444 closes an HTTP request without a normal HTTP response; through Cloudflare the visitor may see a proxy error instead. Broader subnet/ASN blocks can affect legitimate users and are not enabled automatically.

## Validation evidence

Artifacts are local under `.codex-artifacts/` (not public and excluded from Docker):

- `security-review-final-audit.json`: npm audit reports zero known vulnerabilities across production and development dependencies.
- `security-review-focused-tests.json`: 171/171 focused security/auth/tenant/webhook/domain tests pass.
- AI frontend gateway tests: 10/10 pass, including namespace traversal rejection.
- TypeScript check and targeted ESLint: pass.
- `security-review-complete-tests.json`: full suite 1,284 tests, 1,281 passed, 3 failed. The same three failures appeared in an earlier audit run: `tests/integration/auth-backend-readiness-route.test.ts` (readiness mock), `tests/integration/auth-schema-readiness.test.ts` (schema fixture), and `tests/unit/mobile-sidebar-mfa-ui.test.ts` (legacy UI assertion). Their readiness/UI source modules were not modified, but a pristine-checkout baseline was not separately run. The complete suite is therefore not green; authentication schema checks were not weakened to make these fixtures pass.
- A later full run after updating the readiness route and both schema/readiness fixtures passed 1,287 of 1,288 tests. Only the legacy `mobile-sidebar-mfa-ui.test.ts` assertion remains; it checks removed artwork implementation strings. TypeScript and the production Next.js build pass. The Worker passes a local Wrangler dry run with Node 24 but its Cloudflare Git integration check failed. The Cloudflare build log requires dashboard access and is not available from this workspace.
- `security-review-build-configured.log`: production Next.js 15.5.25 build passes, including lint/type stages and all 191 static pages. Existing CSS/unused-code warnings remain. The first build compiled and passed lint/type stages but could not prerender without the required dashboard URL; the successful second build uses the documented public origins and no fabricated secrets.
- A pattern scan of 832 tracked text files did not find the selected credential patterns; this does not establish that no secret exists in history or external configuration.

Read-only production checks: public website 200; admin hostname redirects to Cloudflare Access; anonymous API admin overview 401. At review time production `/api/health` returned 503 and still exposed internal readiness keys, confirming that the local health fix needs deployment. No probing or brute-force load was sent to production.

## 2026-09-19 deployment gate

Read-only production health reported database and authentication schema ready and object storage healthy, but the policy flags for mandatory second factor, email fallback, signup OTP, and trusted browser were false; public health still returned 503 and exposed readiness details. Deploying the fail-closed authentication change without first setting and verifying the intended production OTP/MFA environment risks preventing users without TOTP from signing in. Do not merge to the production branch until the production owner configures these server-side flags and validates login, registration, recovery and admin access in a staging environment. The host firewall, Nginx, Cloudflare WAF and Worker files remain deployment artifacts until installed through their respective control planes. The exact 200-requests/second alert requires an independent edge analytics counter and is not implemented by this repository.
