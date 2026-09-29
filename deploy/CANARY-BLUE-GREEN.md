# Canary / Blue-Green production rollout

This runbook is the release gate for infrastructure, runtime, dependency, or database changes. It assumes two independently deployable origins behind a proxied Cloudflare Load Balancer:

- `blue`: the currently proven production release.
- `green`: the candidate release. It starts at weight `0` and remains directly reachable only from trusted operators and health monitors.

Never reuse a database migration that is destructive or incompatible with the blue release. Use expand → migrate/backfill → contract, and perform the contract step only after the rollback window has closed.

## Preconditions

1. CI is green: locked install, audit, lint, type-check, unit/integration/security/cron tests, E2E, and production build.
2. Images are referenced by immutable digest and the release SHA is recorded.
3. Blue and green use the same required secrets, schema-compatible configuration, TLS policy, and external-service limits.
4. `/api/health` returns `200 {"ok":true}` from each origin through its canonical Host header. Detailed diagnostics use the server-only `HEALTH_CHECK_TOKEN`; never put that token in Cloudflare health-monitor headers or client-visible configuration.
5. Green passes a private smoke test for login, dashboard, a read path, and a reversible write path. Confirm database connection-pool headroom before any traffic shift.
6. Dashboards separate blue and green by release/origin and show request rate, p50/p95/p99 latency, 4xx/5xx/52x, memory/RSS, CPU, event-loop lag, restarts, database pool usage, Redis errors, and upstream connection reuse.

## Cloudflare layout

Create separate healthy pools for blue and green and attach the same HTTP(S) monitor to both. Use Random traffic steering with pool weights. Cloudflare normalizes each pool's weight against the sum of healthy pool weights, so `blue=90, green=10` represents a 90/10 split while both pools are healthy.

Recommended monitor:

- Path: `/api/health`
- Expected status: `200`
- Expected body: `"ok":true`
- Host header: the canonical API hostname
- Timeout: 5 seconds
- Interval: 60 seconds
- Retries: 2
- Health threshold: all required endpoints in a single-endpoint pool, or an explicitly documented quorum for multi-endpoint pools

Keep the blue pool as the fallback pool throughout the canary. If the application keeps server-local session state, fix that architecture before rollout; otherwise enable short-lived Cloudflare cookie affinity only when continuity is genuinely required. Affinity takes precedence over weights and can make observed canary percentages converge more slowly.

## Release sequence

| Stage | Blue | Green | Minimum hold | Promotion gate |
| --- | ---: | ---: | ---: | --- |
| Warm-up | 100% | 0% | 10 min | Green health and private smoke checks pass; caches and connection pools are warm |
| Canary 1 | 90% | 10% | 30 min | All automated gates below pass |
| Canary 2 | 80% | 20% | 30 min | Gates pass at representative traffic and upstream keep-alive is stable |
| Expansion | 50% | 50% | 30 min | No release-correlated regression; database and Redis remain below saturation |
| Green primary | 0% | 100% | 60 min | Gates pass; blue stays deployable and warm |
| Close | 0% | 100% | 24 h | Rollback window closes; only then schedule contract migrations and blue retirement |

Do not promote on a timer alone. A low-volume period may need a longer hold so the sample is meaningful.

## Automated gates

Compare green with blue over the same rolling window and stop promotion when any gate fails:

- Green `5xx + Cloudflare 52x` rate is greater than `1%`, or more than `0.5 percentage points` above blue.
- Green p95 latency is more than `20%` above blue for 10 consecutive minutes.
- Process memory is above `80%` of the container limit for 10 minutes, shows monotonic growth, or triggers an OOM/restart.
- Database pool utilization is above `80%`, acquisition p95 exceeds `250 ms`, or connection errors increase.
- Redis/upstream failures increase, upstream keep-alive reuse drops unexpectedly, or event-loop lag p95 exceeds `100 ms`.
- Any security/authentication regression, failed health monitor, failed synthetic journey, duplicate side effect, or incompatible schema error occurs.

Use both absolute thresholds and blue-relative comparisons. A healthy canary must not hide a system-wide incident affecting both pools.

## Immediate rollback

1. Set green weight to `0` and blue to `100`; do not wait for the next stage boundary.
2. Confirm the blue pool is healthy and synthetic journeys recover.
3. Preserve green logs, traces, metrics, release SHA, and the exact traffic-change timestamps.
4. Stop background workers from green if they can create duplicate side effects. Roll back workers and web traffic as one release unit unless compatibility was explicitly proven.
5. Do not reverse an irreversible database migration. Deploy a forward-compatible corrective migration or restore according to the tested database recovery plan.
6. Open an incident record and require a new green release plus the full warm-up sequence before retrying.

## Blue-green alternative

For a strict blue-green switch, keep green at weight `0`, complete private validation, then change to `blue=0, green=100`. Keep blue healthy for at least one hour and use the same automated rollback gates. This is faster but has a larger blast radius than the 10% → 20% canary and should be reserved for changes already exercised under production-equivalent load.

## Evidence to retain

Record release SHAs and image digests, migration IDs, pool weights and timestamps, health-monitor events, gate snapshots for every stage, the approver, rollback decision, and the time blue was retired. A release is not complete until this evidence is attached to the deployment record.
