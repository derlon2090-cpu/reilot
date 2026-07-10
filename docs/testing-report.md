# RenewPilot AI Testing Report

Date: 2026-07-10

## Provider

WhatsApp Provider:
Evolution API self-hosted

Infrastructure:
VPS + Docker Compose + Evolution API + PostgreSQL + Redis + Nginx + SSL

## Scope

Implemented and executed a professional automated test suite for:

* Unit tests:
  * auth
  * permissions
  * quota
  * message safety
  * template rendering
  * encryption
  * Evolution provider client contracts

* Integration tests:
  * database migration contracts
  * tenant isolation
  * Evolution instance creation
  * QR generation
  * WhatsApp connection status
  * send test message
  * webhook handling
  * email mocks
  * subscription reminder flow

* Cron tests:
  * renewal reminders
  * message queue
  * message retry
  * usage reset
  * Evolution health check
  * cleanup

* Security tests:
  * secret redaction
  * API/session auth
  * tenant access
  * rate limiting
  * webhook verification
  * Evolution API key protection

* E2E tests:
  * login smoke flow
  * onboarding/dashboard smoke
  * linked devices page
  * WhatsApp QR modal
  * WhatsApp connected state
  * subscriptions
  * customers
  * notifications
  * settings persistence
  * billing plan selection

All provider-dependent tests use mocks. No production database, real Evolution server, Resend, or payment provider is used during automated tests.

## Required Manual Staging Tests Before Launch

Before launch, run these manually on staging:

1. VPS health:
   * Docker is running.
   * Evolution API container is running.
   * Postgres container is running.
   * Redis container is running.
   * Nginx is running.
   * SSL is active.

2. Evolution API URL:
   * `EVOLUTION_API_URL` resolves successfully.
   * HTTPS works.
   * Port 8080 is not publicly exposed.
   * Evolution API is only accessed through HTTPS reverse proxy.

3. RenewPilot environment:
   * `WHATSAPP_PROVIDER=evolution`
   * `EVOLUTION_API_URL` is set.
   * `EVOLUTION_API_KEY` is set.
   * `EVOLUTION_WEBHOOK_SECRET` is set.
   * No duplicate `WHATSAPP_PROVIDER`.

4. Linked devices flow:
   * Create instance.
   * Show QR.
   * Scan QR from WhatsApp.
   * Status becomes connected.
   * Phone number appears.
   * Send test message.
   * Message arrives.
   * Disconnect device.
   * Reconnect device.

5. Tenant isolation:
   * Tenant A cannot see or use tenant B instance.
   * Tenant A cannot send through tenant B WhatsApp.
   * API returns 403 for cross-tenant access.

6. Safety system:
   * Message limits work.
   * Queue works.
   * Quiet hours work.
   * Duplicate prevention works.
   * Unsubscribe works.
   * Risk score works.
   * Sending stops when instance is disconnected.

7. Cron:
   * renewal-reminders creates queue only.
   * message-retry sends through Evolution.
   * health-check updates instance status.
   * usage-reset creates new monthly usage.
   * cleanup does not delete important logs.

8. Security:
   * `EVOLUTION_API_KEY` does not appear in frontend.
   * `EVOLUTION_API_KEY` does not appear in API responses.
   * `.env` is not committed.
   * Logs do not print secrets.
   * Webhook rejects invalid secret.
   * Cron rejects invalid `CRON_SECRET`.

## Current Result

Automated tests passed:

* Unit: 13 passed / 0 failed.
* Integration: 9 passed / 0 failed.
* Security: 11 passed / 0 failed.
* Cron: 10 passed / 0 failed.
* E2E: 8 passed / 0 failed.
* Total: 51 passed / 0 failed.
* Build: passed.
* npm audit: passed, 0 vulnerabilities.

## Important Note

The automated tests are good, but they are mocked. Before production launch, we must run real staging tests against:

* Dedicated Neon test branch.
* Real Evolution API staging VPS.
* Real QR scan.
* Real WhatsApp test number.
* Real Resend staging email.
* Real Vercel environment variables.

Do not use production data for staging tests.
