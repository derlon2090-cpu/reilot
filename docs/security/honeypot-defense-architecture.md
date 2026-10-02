# Renvix layered deception and containment architecture

## Objective

Detect commodity reconnaissance without paging operators, distinguish direct
deep-file extraction from accidental discovery, and produce a high-confidence
signal only when a visitor follows a cryptographically issued canary. The
system never exposes production data, accepts credentials, or performs
counter-attacks.

## Trust boundaries

```text
Internet
  |
  v
Cloudflare WAF / rate limits
  |-- production hosts: block probe paths before origin
  `-- admin.renvix.app: isolated Worker honeypot only
          |
          +--> stage classifier + synthetic artifacts
          +--> signed, device-bound, 24-48h deep canary
          +--> signed-device + trusted-IP lookup on every request
          +--> first-request denial for high-confidence extraction
          +--> Durable Object progression counter
          |       `--> optional account-wide 7-day edge containment
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
| 0 | Surface discovery | `/`, `/login`, arbitrary paths | Static session shell | Telemetry only |
| 1 | Config/runtime probe | `/.env.*`, `/.vscode/*`, `/actuator/*`, `/api/gql` | Synthetic bounded artifact with signed deep link | LOW/TELEMETRY |
| 2 | Extraction attempt | `/storage/logs/*`, `*.log`, credentials, backups, dumps, `.git/*` | Immediate 403 after recording | Permanent signed-device block and seven-day IP block |
| 3 | Deep canary | `/_internal/archive/manifest.json?c=...` | Immediate 403 after validation | Permanent signed-device block and seven-day IP block |

The deep token is an HMAC over the day, pseudonymous device ID, source trap
family, and fixed target path. It expires after the current/adjacent UTC day,
cannot be replayed from another device ID, and is never forwarded to storage.
Only `canary_validated=true` is retained.

## Evidence policy

- Store trusted `CF-Connecting-IP`, Cloudflare approximate region/ASN, bounded
  user agent, path without query values, trap stage/family, and validation
  booleans.
- Never store submitted credentials, request bodies, cookie values, canary
  tokens, clipboard data, browser history, or exact GPS.
- Surface commodity probe families remain `LOW/TELEMETRY` and do not create
  real-time webhook/push noise.
- A signed deep-canary traversal adds 35 risk points and stage 3 adds 25. A
  direct stage-3 guess remains MEDIUM; a valid progression becomes HIGH.
- The append-only ledger and incident event chain preserve an auditable record.

## Failure modes

- If ingestion is unavailable, the Worker still returns a bounded decoy and
  never exposes an origin.
- If block lookup is unavailable, high-confidence stage 2/3 paths are still
  denied locally; production middleware remains the authoritative central
  device/IP block boundary.
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
