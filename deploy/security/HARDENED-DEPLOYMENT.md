# Strict origin lockdown and edge containment

This supersedes the earlier direct-origin test procedure: after lockdown even
administrator web requests to the public origin IP must time out. SSH/VPN
administration is separate. No Tarpit is used. nftables native address sets
provide efficient kernel lookup without thousands of sequential rules. CPU
cost is low, never literally zero.

## Origin ingress

Install nftables and Python 3.9+. Identify ALL public IPv4/IPv6 NICs using
`ip -br address` and `ip route`. Select physical/public ingress interfaces,
not loopback or Docker bridges. A missed NIC is a bypass. This guard covers
original destination TCP ports 80/443 before DNAT and before conntrack's
established ACCEPT; UDP 80/443 is dropped (origin HTTP/3 is not used). Other
ports are outside this guard: keep app/database/debug/admin ports private and
audit `ss -lntup`, Docker published ports and provider security groups.

```bash
sudo install -d -m 0700 /etc/renvix-secops
sudo install -m 0750 deploy/security/origin-lockdown.py /usr/local/sbin/origin-lockdown.py
# Replace eth0 with actual public NICs; comma-separated if more than one.
sudo env PUBLIC_INTERFACES=eth0 /usr/local/sbin/origin-lockdown.py
printf 'PUBLIC_INTERFACES=eth0\n' | sudo tee /etc/renvix-secops/origin.env >/dev/null
sudo chmod 0600 /etc/renvix-secops/origin.env
sudo install -m 0644 deploy/security/renvix-origin-*.service /etc/systemd/system/
sudo install -m 0644 deploy/security/renvix-origin-refresh.timer /etc/systemd/system/
sudo systemctl daemon-reload
# Enable restore for NEXT boot; rules are already active, do not start it now.
sudo systemctl enable renvix-origin-restore.service
sudo systemctl enable --now renvix-origin-refresh.timer
sudo nft list table inet renvix_origin
```

The refresh validates both official lists and commits one nft transaction.
Any fetch/validation/check failure preserves the running table. On boot the
last successful snapshot loads without a network dependency. A firewall agent
that flushes the whole ruleset can remove this guard: integrate it with the
host firewall owner, alert on missing table and test a controlled reboot.
Changing NICs requires replacing this dedicated table during a controlled
maintenance window; normal refresh changes only Cloudflare sets.

For stricter boot ordering add these drop-ins to BOTH nginx.service and
docker.service, if installed, then daemon-reload:

```ini
[Unit]
Requires=renvix-origin-restore.service
After=renvix-origin-restore.service
```

Install the snapshot before enabling the drop-ins. Monitor the restore and
refresh units for failures. Confirm the nft binary path with `command -v nft`
and adjust the restore unit if needed. Reboots need out-of-band console access
for verification. Existing UFW/iptables policy may still deny Cloudflare;
this guard's ACCEPT does not override later base-chain DROP decisions.

Rollback of ONLY this dedicated guard, with out-of-band access:

```bash
sudo systemctl disable --now renvix-origin-refresh.timer
sudo systemctl disable renvix-origin-restore.service
# Remove service drop-ins if installed, then daemon-reload.
sudo nft delete table inet renvix_origin
```

Kernel sets also support operator-selected network containment:

```bash
# Example ONLY after confirming multiple hostile IPs and subnet ownership:
sudo nft add element inet renvix_origin banned4 '{ 195.178.110.0/24 }'
# Run the refresher to persist the dedicated table snapshot.
```

Do not add Cloudflare proxy CIDRs to banned sets. Behind Cloudflare the
packet source is the proxy; visitor bans belong at the edge. This lockdown
already drops direct visitors regardless of which IP they use.

Allowlisting shared Cloudflare CIDRs proves network source, not ownership of
the Cloudflare zone. Add zone-specific Authenticated Origin Pulls (mTLS) to
the existing HTTPS listener, or use Cloudflare Tunnel with no public origin
listener. Use Cloudflare Full (strict), reject unknown Host/SNI, and never
trust arbitrary forwarded client IP headers. Restrict or disable public HTTP
at origin if only HTTPS origin pulls are needed.

## Honeypot Worker immediate account-scoped Block

The existing Worker now calls its internal EdgeBan Durable Object for each
external page visit, excluding its script/pixel/telemetry resources and the
already signed health probe. It captures CF-Connecting-IP at the request,
not from untrusted log JSON. This direct event path avoids log-export delay.
The first request still receives the isolated decoy response; it cannot be
retroactively dropped. With EDGE_AUTO_BLOCK enabled, the second external page
request within 60 seconds starts a seven-day account block. It applies after Cloudflare
propagation and covers zones in YOUR account, not unrelated Cloudflare users.

```bash
cd deploy/cloudflare/admin-honeypot
# Secret requires Account Firewall Access Rules Write scoped to this account.
npx wrangler secret put CF_EDGE_BLOCK_TOKEN
# Edit wrangler.toml: real CF_ACCOUNT_ID, trusted admin/monitoring egress IPs,
# then EDGE_AUTO_BLOCK = "true".
npx wrangler deploy
```

Auto-block is deliberately false in the checked-in config until the secret,
account ID and trusted test IPs are supplied. It is two-hit, seven-day
containment; the separate host jail in INC-2026-000067.md also uses 2-in-60 / 7 days. Account blocks
can affect shared-IP users across all account zones. Keep this mode only on
the intentionally isolated honeypot; never attach it to normal application
routes. Disable unneeded workers.dev/preview exposure and do not route other
Workers to the honeypot: CF-Connecting-IP has different trust semantics on
Worker subrequests. For IPv6 visitors the API target is ip6.

The DO serializes per-IP requests, stores the returned rule ID, and reconciles
an API success before a storage failure. API failures retry with bounded bursts
via alarms; failures and exhausted bursts are JSON
alerts. Monitor those alerts and API quotas. Per-IP Access Rules have account
limits; for thousands of bans migrate the controller to an account IP list
referenced by one WAF rule, honoring list API limits. Do not promise infinite
capacity or instantaneous propagation. No kernel ban is inferred from an
HTTP-only WAF decision.

The alarm verifies ownership and deletes the IP Access Rule after seven days;
API failures delay removal and are retried. Manual rollback: delete the exact rule_id via
`DELETE /accounts/{account_id}/firewall/access_rules/rules/{rule_id}`.
Disable auto-block before rollback if further containment is unwanted.
The DO keeps its success record, so a manually deleted rule is not recreated
automatically for that IP; reconcile operator unbans and records as part of
incident handling. Cloudflare allow rules can bypass some enforcement;
review existing IP/ASN allow rules, and test from the blocked source.

## Subnet/ASN escalation support

Set a root-owned 0600 `/etc/renvix-secops/edge.env` with CF_ACCOUNT_ID and
CF_EDGE_BLOCK_TOKEN. Install `edge-escalate` as /usr/local/sbin/edge-escalate.
These are EXAMPLES, not automatic decisions or a verified ASN attribution:

```bash
sudo /usr/local/sbin/edge-escalate ip_range 195.178.110.0/24
sudo /usr/local/sbin/edge-escalate asn 48090
```

Run only the intended action after verifying current IP-to-ASN/subnet
ownership and repeated distinct hostile sources. Save returned rule_id for
rollback. The helper creates explicit account Block; repeated operator runs
can create duplicate rules. Never escalate an ASN based on one source alone.

## Access for real administration

The real admin host in this project is wa-admin.renvix.app. Keep
admin.renvix.app public as the isolated honeypot. In Cloudflare Zero Trust:

1. Create a Self-hosted Access application covering ALL wa-admin.renvix.app
   paths, with a short session duration (e.g. 1 hour).
2. Use an Allow policy requiring the exact administrator IdP group, MFA and
   managed-device posture where available. Require all additional controls;
   avoid broad Everyone, email-domain-only, Bypass or public service policies.
3. Protect /admin, /admin/*, /api/admin, /api/admin/* and the admin login
   /advanced-pro-control on every other application alias that still serves
   those routes. Include setup/auth endpoints; do not leave alternate hosts,
   backend URLs or direct provider deployment URLs as bypasses.
4. Machine-only internal APIs need separate applications and tightly scoped
   Service Auth policies with rotated service tokens, not a public Bypass.
   Keep the existing signed honeypot ingestion reachable for its Worker via
   the intended service-auth mechanism; verify it before switching.
5. Enable Access token validation at the origin (signature, issuer, audience,
   expiry) or use Tunnel's Access validation. Header presence alone is not
   authentication. App passwords remain additional authentication after Access.

DNS/Access applications and IdP memberships cannot be applied from this
workspace without the account and policy identifiers. Verify allowed IdP
users and blocked external users, then remove every unprotected admin alias.
VPN is an alternative: bind administration to the private VPN interface and
remove its public listener.

## Fingerprint and verification

Nginx now hides X-Powered-By and ASP.NET version headers from proxy responses.
server_tokens off hides the Nginx version, not the Server: nginx header itself;
removing that header needs a supported headers-more build or an edge transform.
It is not a guarantee that the application cannot be fingerprinted.

```bash
HOST=app.example.com
ORIGIN=203.0.113.10
# Normal public proxied route must remain 200.
curl --http1.1 --fail-with-body -sS -o /dev/null -w '%{http_code}\n' "https://$HOST/api/health"
curl -sSI "https://$HOST/api/health"
# From ANY non-Cloudflare external source, direct access must time out BEFORE TLS.
curl --http1.1 --resolve "$HOST:443:$ORIGIN" --connect-timeout 3 --max-time 5 -v "https://$HOST/api/health"
curl --connect-timeout 3 --max-time 5 -v "http://$ORIGIN/"
# Repeat over public IPv6 using --resolve "HOST:443:[ORIGIN_IPV6]".
sudo nft list chain inet renvix_origin ingress
# Verify Nginx 444 locally on the existing local listener (outside public NIC guard):
curl --http1.1 -H "Host: $HOST" --max-time 3 -v http://127.0.0.1/index.php
# Host-managed HTTP listener: expected curl 52/HTTP 000. Adapt for Docker local mapping.
```

For Worker testing use a disposable controlled egress IP not in TRUSTED_TEST_IPS,
visit the honeypot once, confirm edge_ip_banned JSON and its account rule ID,
then test a proxied application request from the same source. Expect an edge
HTTP block; the edge TLS handshake still succeeds. Normal traffic from a
different source must remain 200. Recheck honeypot ingestion, Access protected
hosts, IPv6 and a controlled reboot before declaring the deployment complete.

References:
- https://developers.cloudflare.com/fundamentals/concepts/cloudflare-ip-addresses/
- https://developers.cloudflare.com/api/resources/firewall/subresources/access_rules/methods/create/
- https://developers.cloudflare.com/ssl/origin-configuration/authenticated-origin-pull/
