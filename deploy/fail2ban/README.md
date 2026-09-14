# Web scanner jail

These files are deployment artifacts for a host-managed Nginx installation.
They are not activated by a Git push or by the Vercel frontend.

1. Copy `filter.d/web-scanners.conf` to `/etc/fail2ban/filter.d/`.
2. Copy `jail.d/web-scanners.local` to `/etc/fail2ban/jail.d/`.
3. Verify the filter against the active log before enabling it:

   ```sh
   sudo fail2ban-regex /var/log/nginx/access.log /etc/fail2ban/filter.d/web-scanners.conf
   ```

4. Validate and reload the services:

   ```sh
   sudo nginx -t
   sudo fail2ban-client -t
   sudo systemctl reload nginx
   sudo systemctl restart fail2ban
   sudo fail2ban-client status web-scanners
   ```

The jail bans an address for 24 hours after three matching 403, 404, or 444
responses within ten minutes. If Nginx runs in Docker, expose its access log to
the host or use the host's container log backend before enabling this jail.

SSH hardening must be audited in a separate, already authenticated server
session. Do not disable password authentication until key login has been tested
in a second session.

## Host firewall and SSH audit

Run these commands only from an authenticated production-server session:

```sh
sudo ufw deny from 91.92.241.196 to any comment 'honeypot scanner git probe'
sudo ufw deny from 136.110.69.22 to any comment 'honeypot scanner env probe'
sudo ufw deny from 146.70.134.142 to any comment 'honeypot scanner bot-connect probe'
sudo ufw reload
sudo ufw status numbered

sudo sshd -T | grep -E '^(permitrootlogin|passwordauthentication) '
sudo ss -lntup
```

Before changing SSH authentication, confirm key-based login in a second active
session. Then place an override in `/etc/ssh/sshd_config.d/`, validate it with
`sudo sshd -t`, and use `sudo systemctl reload ssh` so an invalid configuration
never replaces the running daemon. Database ports should be bound to localhost
or a private network and must not be exposed by UFW.

Only the confirmed individual scanner addresses are denied here. Blocking an
entire hosting ASN requires a separately verified CIDR inventory and a review of
legitimate traffic to avoid broad collateral blocking.
