# Strong-attack hardening review — 2026-09-26

This change strengthens the repository deployment artifacts against scanner
bursts, credential attacks, Slowloris-style connection pressure, expensive API
floods, and direct-origin bypass. It does not claim that one application host
can absorb a volumetric DDoS attack; that traffic must be mitigated at the edge
before it reaches the origin.

## Added controls

- Unknown Host headers and direct-IP virtual hosts close with Nginx 444.
- Per-client connection and request budgets bound work at the reverse proxy.
- Authentication mutations use a separate low-rate token bucket.
- Header/body/keepalive/send timeouts limit slow-connection resource holding.
- TRACE and CONNECT are rejected at both Cloudflare custom WAF and Nginx.
- Proxy retries are disabled so an attack cannot multiply upstream work.
- WebSocket upgrades are sent only when the client actually requested one.
- Docker Compose now mounts the required HTTP-context maps and rate-limit zones.
- One idempotent Cloudflare rate-limit rule covers authentication, AI, and
  storage APIs while remaining compatible with small custom-rule quotas.

## Required deployment order

1. Confirm every public hostname is proxied and no provider deployment alias
   bypasses the zone. Disable default provider hostnames where supported.
2. On a self-managed origin, apply `origin-lockdown.py` for all public IPv4 and
   IPv6 interfaces, or use Cloudflare Tunnel. Add zone-specific Authenticated
   Origin Pulls when using a public HTTPS listener.
3. Install the custom WAF and rate-limit helpers from `README.md`. Read back the
   created rule IDs and verify the rules are enabled.
4. Run `nginx -t`, deploy the gateway/server configuration, then test normal
   login, MFA/OTP, uploads, AI operations, webhooks, and health checks.
5. Generate a controlled burst from a disposable address. Confirm edge 429/403
   responses, Nginx 429 responses, bounded logs, and unaffected traffic from a
   second address. Never load-test production without an approved window.

## Operational guardrails

- Do not block an entire commercial ASN solely because one address scanned.
- Do not trust `CF-Connecting-IP` unless the packet source is restricted to
  Cloudflare ranges (or the request arrives through Tunnel/AOP).
- Install `sync-cloudflare-realip.py` before enabling Nginx per-client limits
  behind the proxy. Without trusted real-IP restoration, all users sharing a
  Cloudflare egress address consume the same origin bucket and can cause an
  avoidable outage.
- Keep Cloudflare HTTP DDoS managed protection enabled. Start custom DDoS
  overrides in log/managed-challenge mode and use observed traffic before
  selecting a stricter action.
- Rate limits are availability controls, not authentication. Turnstile,
  password hashing, MFA/OTP, session/RBAC checks, and origin validation remain
  mandatory.
- Monitor 429 rate, origin latency, 5xx/52x rates, open connections, worker
  saturation, database connections, and filesystem usage. Alert on a missing
  origin firewall table or failed Cloudflare rule refresh.
