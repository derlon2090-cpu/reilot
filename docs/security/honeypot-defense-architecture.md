# Renvix layered deception and containment architecture

## Objective

Stop every visitor to the isolated administration honeypot immediately, keep a
seven-day source-IP block in Cloudflare Durable Objects, and record signed,
bounded evidence for central device containment. The system never exposes
production data, accepts credentials, or performs counter-attacks.

## Trust boundaries

```text
Internet
  |
  v
Cloudflare WAF / rate limits
  |-- production hosts: block probe paths before origin
  `-- admin.renvix.app: isolated Worker honeypot only
          |
          +--> stage classifier for evidence
          +--> immediate 403 block page for every visitor route
          +--> Durable Object IP block written before response (7 days)
          |       `--> optional account-wide Cloudflare IP rule
          +--> signed-device event for central containment
          `--> HMAC-signed bounded event
                    |
                    v
             Security ingestion API
                    |
                    +--> append-only event ledger
                    +--> correlated risk scoring
                    +--> risk-qualified device containment
                    `--> digest-only operator telemetry

Origin Nginx
  `--> silent 444 for reserved probe families; no upstream I/O

Host kernel
  `--> persistent ipset + silent DROP for confirmed sources
```

The honeypot Worker and the real administration deployment share no code,
assets, session cookies, redirects, or origin routes. `wa-admin.renvix.app`
must remain behind Cloudflare Access; `admin.renvix.app` must route only to the
isolated Worker.

## Trap stages

| Stage | Meaning | Examples | Response | Containment |
|---|---|---|---|---|
| 0 | Surface discovery | `/`, `/login`, arbitrary paths | Immediate 403 block page | Seven-day local IP block and signed-device event |
| 1 | Config/runtime probe | `/.env.*`, `/.vscode/*`, `/actuator/*`, `/api/gql` | Immediate 403 block page | Seven-day local IP block and signed-device event |
| 2 | Extraction attempt | `/storage/logs/*`, `*.log`, credentials, backups, dumps, `.git/*` | Immediate 403 block page | Seven-day local IP block and signed-device event |
| 3 | Deep canary | `/_internal/archive/manifest.json?c=...` | Immediate 403 block page | Seven-day local IP block and signed-device event |

Existing signed canary validation remains in place for old links and staged
security testing. The current honeypot does not issue synthetic artifacts or
canary links to visitors.

## Evidence policy

- Store trusted `CF-Connecting-IP`, Cloudflare approximate region/ASN, bounded
  user agent, path without query values, trap stage/family, and validation
  booleans.
- Never store submitted credentials, request bodies, cookie values, canary
  tokens, clipboard data, browser history, or exact GPS.
- Exact `TRUSTED_TEST_IPS` addresses receive the 403 response and the local
  honeypot-only block, while remaining excluded from account-wide rules and
  event persistence.
- Untrusted honeypot visits trigger device containment even when the path is a
  common route; the risk-score floor ensures that an auditable incident row is
  created for that automatic block.
- A signed deep-canary traversal adds 35 risk points and stage 3 adds 25. A
  direct stage-3 guess remains MEDIUM; a valid progression becomes HIGH.
- The append-only ledger and incident event chain preserve an auditable record.

## Failure modes

- If ingestion or block lookup is unavailable, the Worker still stores the
  source-IP block in its Durable Object and returns 403 immediately.
- If the Durable Object binding is unavailable, the first visitor request is
  still denied; persistence cannot be guaranteed until the binding is restored.
- If Cloudflare containment fails, Durable Object alarms retry without creating
  duplicate owned rules.
- `EDGE_AUTO_BLOCK=false` is the safe default. Enabling it is an explicit,
  account-wide operational decision with trusted test IP exemptions.
- The current optional edge controller uses Cloudflare IP Access Rules. Migrate
  it to an account IP list plus a WAF custom rule when plan/API lifecycle permits;
  Cloudflare currently recommends custom rules for IP-based blocking.

## Deployment gates

1. Run unit/security tests and syntax checks.
2. Deploy database/application ingestion changes before the Worker.
3. Set `HONEYPOT_INGESTION_SECRET` independently on Worker and API.
4. Deploy the Worker with `EDGE_AUTO_BLOCK=false` and validate signed events.
5. Exercise stages 0-3 from an exempt controlled address.
6. Confirm query tokens are absent from database/log exports.
7. Enable edge auto-block only after verifying the account scope, token
   permission, trusted IP exemptions, expiry alarm, and rollback.
8. Observe false positives and ingestion latency for 24 hours before widening.

## Rollback

Set `EDGE_AUTO_BLOCK=false`, deploy the previous Worker version, revoke only
rules whose notes equal `renvix-honeypot:<ip>`, and leave the ingestion schema
intact for forensic continuity. Do not delete append-only ledger records.
