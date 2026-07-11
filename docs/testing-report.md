# RenewPilot AI - Final Verification Report

Date: 2026-07-11

## Implemented Scope

- Arabic RTL and English LTR across public, auth, and dashboard pages.
- Persistent light/dark theme and locale using `renewpilot_theme` and `renewpilot_locale`.
- Registration, login, logout, forgot-password, verification-code, and password-reset APIs.
- Resend server service with verified-domain guard, hashed reset codes, expiry, attempts, and redacted email logs.
- Linked devices UI, QR/pairing states, Evolution API integration endpoints, and WhatsApp health scoring.
- Safe sending, warm-up limits, duplicate/quiet-hour/risk checks, message-quality analysis, unsubscribe center, and explicit blocked reasons.
- Quick renewal with activity logging and end-of-month-safe date extension.
- Excel/TSV import preview with row validation and duplicate reporting.
- Live cron runners for reminders, retry, health checks, usage reset, and cleanup.
- Docker/OVH package with PostgreSQL, Nginx, automatic migrations, health checks, and cron examples.

## Automated Verification

Executed against the current worktree:

- Unit: 21 passed, 0 failed.
- Integration: 11 passed, 0 failed.
- Security: 12 passed, 0 failed.
- Cron: 10 passed, 0 failed.
- E2E: 13 passed, 0 failed.
- Total: 67 passed, 0 failed.
- Production build: passed (25 generated routes/pages).
- `npm audit --omit=dev`: 0 vulnerabilities.

E2E coverage includes Arabic/English persistence, RTL/LTR direction, light/dark persistence, login, registration fields, subscription/customer workflows, linked devices, WhatsApp actions, notification templates, modal close via X/Escape/cancel/overlay, settings persistence, billing selection, and logout.

## Resend Readiness

- `RESEND_API_KEY` in the current local environment: missing.
- `RESEND_FROM_EMAIL` in the current local environment: missing.
- Verified Resend domain: not verifiable without account/environment access.
- `/api/auth/forgot-password`: implemented and production-built; live delivery not testable without database and Resend variables.
- `password_reset_codes`: created by migration `0004_product_auth_safety.sql`; codes are stored only as SHA-256 hashes and expire after 10 minutes.
- `email_logs`: extended for user, provider, type, status, provider ID, and redacted error logging.
- Resend Dashboard attempt: not available because credentials are absent.
- Email received: not verifiable because credentials and a verified sender are absent.

The service refuses Gmail, Hotmail, Outlook, and Yahoo senders. Do not mark email delivery ready until a verified domain sender is configured and `/api/dev/test-resend` plus the full forgot-password flow succeed on staging.

## OVH Deployment Status

Target: `ubuntu@51.210.7.137`.

The supplied objective listed `C:\Users\waehs.ssh\id_ed25519`, which does not exist. The available key is `C:\Users\waehs\.ssh\id_ed25519`; OVH rejected it with `Permission denied (publickey,password)` on repeated connection attempts.

Deployment artifacts are ready, but no server changes were made because SSH authentication failed. Production deployment still requires either adding the matching public key to the OVH instance or providing the correct private key. Docker is also not installed on this local Windows environment, so the Compose file was syntax-reviewed and the application artifact was production-built, but the image could not be built locally.

## Mandatory Staging Gate

Before importing real customer data:

1. Restore SSH access and deploy to `/opt/renewpilot`.
2. Configure strong production secrets and a verified Resend sender.
3. Run migrations and verify `/api/health` reports database connectivity.
4. Run a real Resend test and forgot-password email, then inspect `password_reset_codes` and `email_logs` without exposing codes or keys.
5. Connect a dedicated WhatsApp test number through Evolution API, scan QR, send a test message, disconnect, and reconnect.
6. Install the cron entries and verify activity logs for each job.
7. Add HTTPS after DNS points to the VPS; do not expose PostgreSQL or Evolution API ports publicly.
