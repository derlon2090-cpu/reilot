# Probe containment deployment

For the first-hit / seven-day policy prepared for incidents 202 and 203, use
`INC-2026-000202-000203.md`. The enabled scanner jail and the optional sentry
now use the same threshold and ban duration.

The latest four incident groups add the IDE/config, GraphQL/actuator,
environment, log-extraction, and canary vectors plus eight confirmed source
addresses. `cloudflare-latest-incidents-rule.json` is the requested single
terminating edge rule. It deliberately blocks the listed commercial-cloud
ASNs globally; review expected AWS, Google Cloud, and DigitalOcean client
traffic before enabling it because this can block legitimate users.

These are Linux deployment artifacts, not an active server deployment. The
exact requested WAF rule is intentionally broader than the safer managed-
challenge policy and includes a wholesale AS48090 block. Reserved decoy paths
must not be legitimate PHP or WordPress application routes. Shared NAT IP bans
can affect other users on the same IP; zero collateral impact cannot be
guaranteed with IP-based containment.
This threshold protects decoy routes, not real login brute force; real logins
need separate authentication-failure counters and rate limits.

## Immediate permanent block (choose the host firewall manager in use)

Direct Linux host, including established sessions because this precedes ACCEPT:

```bash
sudo iptables -w -C INPUT -s 195.178.110.72 -j DROP 2>/dev/null || sudo iptables -w -I INPUT 1 -s 195.178.110.72 -j DROP
# Debian/Ubuntu, with iptables-persistent/netfilter-persistent installed:
sudo netfilter-persistent save
sudo iptables -w -vnL INPUT --line-numbers
```

Do not persist Fail2ban's transient chains with iptables-save. Save static rules
before starting Fail2ban; its SQLite database restores unexpired bans itself.
Set `dbpurgeage = 172800` in `/etc/fail2ban/fail2ban.local` under `[Definition]`.
Do not change this file's other existing settings.

For an ALREADY enabled UFW firewall (persistent automatically):

```bash
sudo ufw insert 1 deny from 195.178.110.72 to any comment 'confirmed honeypot scanner'
sudo ufw status numbered
```

UFW's early established-connection accept can preserve old sessions. If
conntrack-tools is installed, clear only this source's established entries:

```bash
sudo conntrack -D -s 195.178.110.72
```

Do not enable UFW without first preserving SSH/admin access. Docker-published
ports bypass INPUT/UFW. For Docker with its iptables backend, additionally:

```bash
sudo iptables -w -C DOCKER-USER -s 195.178.110.72 -j DROP 2>/dev/null || sudo iptables -w -I DOCKER-USER 1 -s 195.178.110.72 -j DROP
```

Reapply the Docker rule with host configuration management AFTER Docker starts
on every boot. For the dynamic jail change `iptables-allports`'s `chain` to
`DOCKER-USER` if the protected service is Docker-published; check chain ordering
and counters. Docker's nftables backend requires its own forward-hook rules;
do not use the DOCKER-USER instructions there.

## Cloudflare WAF permanent + dynamic block

Requires bash, curl (7.76+), jq, and a Zone WAF Write API token. Do not commit
tokens. Store this root-owned file with mode 0600:

```bash
sudo install -d -m 0700 /etc/renvix-secops
sudo install -m 0600 /dev/null /etc/renvix-secops/cloudflare.env
# Edit with sudoedit. The installer discovers or creates the zone's
# http_request_firewall_custom entrypoint:
sudoedit /etc/renvix-secops/cloudflare.env
```

File content:

```bash
CF_API_TOKEN='REPLACE_WITH_SCOPED_TOKEN'
CF_ZONE_ID='REPLACE_WITH_ZONE_ID'
```

Find the entrypoint via `GET
/zones/{zone_id}/rulesets/phases/http_request_firewall_custom/entrypoint`.
If none exists, create a zone ruleset with phase
`http_request_firewall_custom` and kind `zone`; use its returned ID.
Install the two idempotent custom rules (sensitive routes are blocked first;
the listed commercial-hosting ASNs receive a managed challenge elsewhere):

```bash
sudo install -m 0750 deploy/security/install-probe-waf /usr/local/sbin/install-probe-waf
sudo /usr/local/sbin/install-probe-waf \
  deploy/security/cloudflare-probe-expression.txt \
  deploy/security/cloudflare-cloud-asn-expression.txt \
  deploy/security/cloudflare-protocol-abuse-expression.txt \
  deploy/security/cloudflare-latest-incidents-expression.txt
sudo install -m 0750 deploy/security/install-edge-rate-limits /usr/local/sbin/install-edge-rate-limits
sudo /usr/local/sbin/install-edge-rate-limits
```

The scripts use `POST .../rules` for creation and `PATCH .../rules/{rule_id}`
for updates, so it does not replace unrelated custom rules. The production
route rule excludes `admin.renvix.app`, where the isolated honeypot intentionally
collects silent telemetry; remove that exception only if the honeypot is retired.
The rate-limit helper deliberately installs one consolidated sensitive-API
rule so it fits small plan quotas. Its defaults are 20 requests per 10 seconds
per source IP/Cloudflare colo with a 10-second mitigation. Increase periods or
timeouts only to values supported by the active plan; tighter limits require a
controlled traffic baseline to avoid harming shared-NAT users. Run only one
controller for these owned rule refs. Cloudflare plan quotas apply; per-IP WAF
rules are suitable for modest ban counts, not high-volume botnets.

```bash
sudo install -m 0750 deploy/security/probe-cloudflare /usr/local/sbin/probe-cloudflare
sudo /usr/local/sbin/probe-cloudflare ban 195.178.110.72 permanent
# Explicit rollback, when appropriate:
# sudo /usr/local/sbin/probe-cloudflare unban 195.178.110.72 permanent
```

The permanent ref is separate from dynamic refs, so dynamic unbans cannot
remove the confirmed static block. Rules have no automatic expiry. Fail2ban
removes its dynamic rule after 86400 seconds. Monitor Fail2ban action errors
and reconcile dynamic rules if Fail2ban loses its DB or an API unban fails;
expiry is not guaranteed while its controller is down. Neither WAF nor Nginx
can reject the visitor's TLS handshake at Cloudflare's edge.

## Nginx and trusted client IP

`deploy/nginx.conf` now drops reserved paths in server rewrite phase before
upstream selection. Include `probe-log.conf` in the `http {}` context BEFORE
that server config. It logs only decoy attempts to the dedicated log, without
request-controlled text. No log buffer delays first-hit detection.
The paths use normalized `$uri`, including percent-decoding; query strings
do not bypass detection. Keep this gate in all public HTTP and HTTPS servers.
Preserve existing certificates, TLS settings and application locations.

With Cloudflare, configure `real_ip_header CF-Connecting-IP` and
`set_real_ip_from` for ONLY Cloudflare's current published IPv4/IPv6 CIDRs
(https://www.cloudflare.com/ips/). Never trust 0.0.0.0/0 or arbitrary
X-Forwarded-For. Verify real IP logs before enabling auto-bans. Restrict origin
ingress to Cloudflare CIDRs plus trusted administration/monitoring networks;
otherwise direct clients can bypass edge WAF. Origin host DROP rules for
visitor IPs do not match Cloudflare's proxy connection IPs: enable the
`probe-cloudflare` action for proxied traffic.

The separate Cloudflare Worker honeypot has no local Nginx access log.
This jail counts Nginx-resident decoy traffic only. Worker requests must be
exported through a trusted logging pipeline into the same exact log schema
before this jail can count them; do not assume Worker console logs appear on
the host. Count each request once, and never export attacker-supplied IP fields.

```bash
sudo install -m 0644 deploy/security/probe-log.conf /etc/nginx/conf.d/00-probe-log.conf
# Install/merge the updated server config into the existing deployment.
# Ensure /var/log/nginx is writable by Nginx and readable by root Fail2ban.
sudo install -m 0750 deploy/security/ipset-probe-action /usr/local/sbin/ipset-probe-action
sudo install -m 0644 deploy/fail2ban/action.d/honeypot-ipset.conf /etc/fail2ban/action.d/
sudo install -m 0750 deploy/security/probe-incident /usr/local/sbin/probe-incident
sudo install -m 0644 deploy/fail2ban/filter.d/honeypot-probes.conf /etc/fail2ban/filter.d/
sudo install -m 0644 deploy/fail2ban/action.d/probe-*.conf /etc/fail2ban/action.d/
sudo install -m 0644 deploy/fail2ban/jail.d/honeypot-probes.local /etc/fail2ban/jail.d/
# Add trusted monitoring/admin egress IPs to ignoreip before enabling.
# Add probe-cloudflare to the action list for Cloudflare-proxied traffic.
sudo nginx -t
sudo fail2ban-client -t
sudo systemctl reload nginx
sudo systemctl restart fail2ban
sudo fail2ban-client status honeypot-probes
sudo journalctl -t renvix-secops -o cat
```

To install the requested permanent `honeypot_blacklist` set and silent INPUT
DROP (plus DOCKER-USER when present), run the idempotent host installer. It
installs both `iptables-persistent` and `ipset-persistent`, then saves the set
before the firewall rules so restoration can resolve the set reference:

```bash
sudo install -m 0750 deploy/security/install-honeypot-blacklist /usr/local/sbin/install-honeypot-blacklist
sudo /usr/local/sbin/install-honeypot-blacklist
```

For immediate first-hit handling without waiting for Fail2ban scheduling,
install the hardened systemd watcher. It consumes only the fixed-format,
path-free probe log and writes a rotating local action log; it sends no push
notifications. Log delivery and scheduler latency mean this is low-latency,
not a guaranteed sub-millisecond path:

```bash
sudo install -m 0750 deploy/security/install-honeypot-sentry /usr/local/sbin/install-honeypot-sentry
sudo /usr/local/sbin/install-honeypot-sentry
sudo systemctl is-active renvix-honeypot-sentry
```

To seed the separate timed Fail2ban ipset with the eight confirmed sources before
Fail2ban sees another request, install and run the validated batch loader. The
entries receive the ipset action's seven-day safety timeout; Fail2ban can
explicitly remove dynamically detected entries sooner according to `bantime`.
Nginx also carries explicit denies for these incident addresses.

```bash
sudo install -m 0750 deploy/security/load-incident-blocklist /usr/local/sbin/load-incident-blocklist
sudo /usr/local/sbin/load-incident-blocklist deploy/security/incident-scanner-ips.txt
sudo ipset list renvix_probe4
```

The general access log excludes decoy probes. Only the minimal line required
for Fail2ban (`IP`, server timestamp, fixed marker, status) is kept in
`honeypot-probes.log`; request paths, headers, query values, and bodies are not
stored there. This prevents scanner traffic from flooding the normal access
log without disabling automated containment.

Keep the old web-scanners jail off the dedicated probe log; its broader
access.log matching and different threshold remain separate. Rotate the new
log using Nginx's existing logrotate policy (reopen with USR1, not copytruncate).
The repository's Compose mounts the HTTP-context security file before the
server file and validates Nginx through an explicit allowed Host header. If a
host Fail2ban process must consume the container log, bind-mount the Nginx log
directory to a root-controlled host path and verify ownership before enabling.

## Verification

Run only from a controlled external test source. Use a second administration
connection with a different source IP. The address 195.178.110.72 cannot be
spoofed with curl or headers; test the permanent rule by counters or from a
source you actually control temporarily banned through the same mechanism.

```bash
HOST=app.example.com
ORIGIN=203.0.113.10
# Use a real known public 200 route; do not follow redirects during testing.
curl --http1.1 --fail-with-body -sS -o /dev/null -w '%{http_code}\n' "https://$HOST/api/health"
# From an allowed admin source, bypass Cloudflare while preserving TLS SNI:
curl --http1.1 --resolve "$HOST:443:$ORIGIN" --fail-with-body -sS -o /dev/null -w '%{http_code}\n' "https://$HOST/api/health"
for path in /wp-admin /wordpress/index.php /index.php /.env /.git/config /%2eenv; do
  curl --http1.1 --path-as-is --resolve "$HOST:443:$ORIGIN" --connect-timeout 3 --max-time 5 -v "https://$HOST$path"
done
# 444 is not an HTTP response: expect curl 52 (empty reply), HTTP 000.
# Cloudflare may convert origin 444 to a 52x; WAF blocks typically return 403.

# From a NON-ignored controlled test IP, one reserved-path request:
curl --http1.1 --resolve "$HOST:443:$ORIGIN" --max-time 3 -sS "https://$HOST/index.php" || true
sudo fail2ban-client status honeypot-probes
sudo fail2ban-regex /var/log/nginx/honeypot-probes.log /etc/fail2ban/filter.d/honeypot-probes.conf
# After the action completes, from that same banned direct-origin test IP:
curl --http1.1 --resolve "$HOST:443:$ORIGIN" --connect-timeout 3 --max-time 5 -v "https://$HOST/api/health"
# Expect connection timeout before TLS; no ServerHello/certificate received.
# From a separate unbanned source the public 200 route must still succeed.
# On the server, remove only the controlled dynamic test ban:
sudo fail2ban-client set honeypot-probes unbanip CONTROLLED_TEST_IP
```

For proxied dynamic testing send one reserved-path request via the proxied hostname
instead; first verify Cloudflare forwards them and the log contains the true
test source. Check the added WAF rule and subsequent HTTP block. A successful
edge TLS handshake is expected and is not a failed WAF test.

Sources: Cloudflare Rulesets API add-rule documentation, Nginx realip and
request-processing documentation, and the upstream Fail2ban jail.conf.

## Honeypot intelligence collector

`honeypot-intel-engine.py` polls the authenticated, path-only export endpoint
or consumes a trusted JSONL file. It accepts only environment, Git, PHP,
storage, credential, and WordPress-manifest families. It never embeds an
attacker-supplied regex: each accepted value becomes a quoted exact-match
location. Updates are atomic, capped at 2,048 paths, tested with `nginx -t`,
and rolled back if validation or reload fails.

Set the same independent 32+ character value as
`HONEYPOT_INTEL_EXPORT_TOKEN` on the application and in the root-owned host
token file, then install and start the service:

```bash
sudo install -m 0750 deploy/security/install-honeypot-intel /usr/local/sbin/install-honeypot-intel
sudo /usr/local/sbin/install-honeypot-intel
sudoedit /etc/renvix-secops/honeypot-intel.token
sudo systemctl start renvix-honeypot-intel
sudo systemctl status renvix-honeypot-intel
```

The Nginx server includes `/etc/nginx/snippets/renvix-honeypot-deny-*.conf`.
Collector mode is enabled with `HONEYPOT_COLLECTOR_MODE=true`: evidence,
incidents, containment, and in-app analysis remain, while email, daily digest,
and critical webhook delivery for `ADMIN_HONEYPOT_ACCESS` are suppressed.
Other production incident types retain their normal alert behavior.

Verify from an exempt controlled source. Direct mode expects origin `444`
(curl HTTP `000`/empty reply); edge mode accepts a Cloudflare `403`:

```bash
sudo PRODUCTION_BASE_URL=https://app.example.com \
  HONEYPOT_BASE_URL=https://admin.renvix.app \
  PRODUCTION_TEST_MODE=direct \
  /usr/local/sbin/verify-honeypot-intel
```
