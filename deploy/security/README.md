# Probe containment deployment

For the current two-hit / seven-day policy and incident 67, use
`INC-2026-000067.md`. The six-hit / 24-hour jail below is the earlier policy
and is disabled in the checked-in configuration.

These are Linux deployment artifacts, not an active server deployment. Never
block AS48090 wholesale. Reserved decoy paths must not be legitimate PHP or
WordPress application routes. Shared NAT IP bans can affect other users on the
same IP; zero collateral impact cannot be guaranteed with IP-based containment.
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
# Edit with sudoedit; use the zone's http_request_firewall_custom entrypoint ID:
sudoedit /etc/renvix-secops/cloudflare.env
```

File content:

```bash
CF_API_TOKEN='REPLACE_WITH_SCOPED_TOKEN'
CF_ZONE_ID='REPLACE_WITH_ZONE_ID'
CF_RULESET_ID='REPLACE_WITH_CUSTOM_PHASE_ENTRYPOINT_ID'
```

Find the entrypoint via `GET
/zones/{zone_id}/rulesets/phases/http_request_firewall_custom/entrypoint`.
If none exists, create a zone ruleset with phase
`http_request_firewall_custom` and kind `zone`; use its returned ID.
The helper adds one rule at the beginning and preserves existing rules. Run
only one controller for its rules. Cloudflare plan rule quotas apply; this
per-IP approach is suitable for modest ban counts, not high-volume botnets.

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
request-controlled text. No log buffer delays the sixth-request detection.
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

Keep the old web-scanners jail off the dedicated probe log; its broader
access.log matching and different threshold remain separate. Rotate the new
log using Nginx's existing logrotate policy (reopen with USR1, not copytruncate).
For Docker mount the format file into conf.d and bind-mount the log directory
to the host; this repository's Compose does not currently install these files.

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

# From a NON-ignored controlled test IP, six requests within 60 seconds:
for i in 1 2 3 4 5 6; do
  curl --http1.1 --resolve "$HOST:443:$ORIGIN" --max-time 3 -sS "https://$HOST/index.php" || true
done
sudo fail2ban-client status honeypot-probes
sudo fail2ban-regex /var/log/nginx/honeypot-probes.log /etc/fail2ban/filter.d/honeypot-probes.conf
# After the action completes, from that same banned direct-origin test IP:
curl --http1.1 --resolve "$HOST:443:$ORIGIN" --connect-timeout 3 --max-time 5 -v "https://$HOST/api/health"
# Expect connection timeout before TLS; no ServerHello/certificate received.
# From a separate unbanned source the public 200 route must still succeed.
# On the server, remove only the controlled dynamic test ban:
sudo fail2ban-client set honeypot-probes unbanip CONTROLLED_TEST_IP
```

For proxied dynamic testing send the six requests via the proxied hostname
instead; first verify Cloudflare forwards them and the log contains the true
test source. Check the added WAF rule and subsequent HTTP block. A successful
edge TLS handshake is expected and is not a failed WAF test.

Sources: Cloudflare Rulesets API add-rule documentation, Nginx realip and
request-processing documentation, and the upstream Fail2ban jail.conf.
