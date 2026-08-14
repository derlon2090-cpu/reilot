# AI token entitlement verification report

Verification date: 2026-08-13 (Asia/Riyadh)

## Policy covered

- Free/trial: 100,000 tokens once per tenant with no periodic refill.
- Starter: 1,000,000 tokens per 168-hour cycle, four cycles, 4,000,000 period cap.
- Professional: 3,000,000 tokens per 168-hour cycle, four cycles, 12,000,000 period cap.
- Business: 5,000,000 tokens per 168-hour cycle, four cycles, 20,000,000 period cap.
- Refill-to-cap semantics: every new cycle starts with its plan allowance, `used=0`, `reserved=0`; balances do not roll over or add together.
- Exactly four paid cycles. No cycle 5 is created in 28, 29, 30, or 31-day periods.
- Cycle membership uses `cycleStart <= now < cycleEnd` in UTC and absolute 168-hour durations.
- Cycle 4 remains usable until the subscription period ends but receives no fifth refill.
- Successful renewal creates a new period at cycle 1. Failed or inactive renewal grants nothing.
- Customer deductions use the provider's actual `response.usage` input and output tokens.
- Internal model/cache/cost accounting is isolated from customer-visible balances.
- Reservations, tenant locking, burst limits, and provider request idempotency protect concurrent usage.
- Free entitlement uniqueness is enforced per tenant, even if a trial subscription row is replaced.

## Automated verification

| Layer | Result | Coverage |
| --- | ---: | --- |
| Vitest unit/integration/DB | 54 passed, 0 failed | Policy boundaries, caps, UI contract, router/provider, PostgreSQL lifecycle and concurrency |
| Playwright E2E | 1 passed, 0 failed | Professional cycles 1-4, no cycle 5, renewal returns to cycle 1 |
| TypeScript | Passed | `tsc --noEmit -p tsconfig.typecheck.json` |
| ESLint (changed entitlement scope) | 0 errors | 38 existing non-blocking warnings in the legacy application UI file |
| Dependency audit | Passed | 0 vulnerabilities reported by `npm audit --audit-level=moderate` |
| Production build | Passed | Next.js optimized build and 160 static pages generated |

Total distinct automated tests in the final entitlement verification set: **55 passed, 0 failed**.

## Database checks

- PostgreSQL rejects cycle number 5 with a check-constraint violation.
- Five concurrent reservations were serialized and could not exceed the final 10,000-token balance.
- Reusing a provider request ID produced one ledger entry and one deduction.
- A multi-call message deducted the aggregated actual total once.
- A failed renewal did not create a new entitlement period.
- Extending or replacing a Free trial did not mint another 100,000 tokens.
- Test tenant data was removed after the database suite.

## Visual verification

The Arabic RTL usage card was checked at desktop (1280×720) and mobile (390×844) viewports. It remained within the viewport, displayed remaining balance/cycle/refill information, and did not expose model names, cache details, internal cost, or routing information.

## Development findings resolved

The real database tests initially exposed two defects: a duplicate provider request could collide at the reservation uniqueness boundary, and a pre-existing tenant-storage cascade trigger attempted to recreate usage rows while deleting a tenant. Both were corrected before the final clean run.
