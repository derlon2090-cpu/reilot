#!/bin/bash
set -euo pipefail

# No external requests or firewall mutations unless TEST_ORIGIN is set.
nginx -t
fail2ban-client -t
fail2ban-regex /var/log/nginx/honeypot-probes.log /etc/fail2ban/filter.d/honeypot-probes.conf
fail2ban-client status honeypot-scanner
ipset list renvix_probe4 >/dev/null
ipset list renvix_probe6 >/dev/null

if [[ -n ${TEST_ORIGIN:-} ]]; then
  # Use a controlled direct-to-Nginx staging endpoint; Cloudflare may turn 444
  # into a proxy error and its WAF can intercept before Nginx.
  for path in '/.env' '/actuator/configprops' '/wordpress/index.php'; do
    status=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 "$TEST_ORIGIN$path" 2>/dev/null || true)
    [[ $status == 000 ]] || { echo "Unexpected probe response: $path $status" >&2; exit 1; }
  done
  status=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 "$TEST_ORIGIN/")
  [[ $status == 200 ]] || { echo "Application root unhealthy: $status" >&2; exit 1; }
fi

echo 'Validation passed. A controlled two-hit source test is still required to verify ban and expiry.'
