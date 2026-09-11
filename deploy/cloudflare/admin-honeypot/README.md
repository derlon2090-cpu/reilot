# Renvix admin honeypot

This Cloudflare Worker is isolated from the real Renvix application and admin
deployment. It serves a self-contained decoy sign-in shell and sends bounded,
signed security events to the existing ingestion service.

The browser telemetry is intentionally aggregated. It includes device and
viewport characteristics plus counts for pointer movement, clicks, scrolling,
key presses, and decoy form submissions. It never reads or sends input values,
passwords, cookies, clipboard data, camera, microphone, or precise geolocation.

Deployment requirements:

1. Keep `admin.renvix.app` proxied by Cloudflare and public; do not attach a
   Zero Trust Access policy to this hostname.
2. Keep `wa-admin.renvix.app` behind Cloudflare Zero Trust.
3. Set the Worker secret with `wrangler secret put HONEYPOT_INGESTION_SECRET`
   and set the same server-only value on the ingestion service.
4. Keep Cloudflare WAF and zone rate limits enabled. The binding in
   `wrangler.toml` is an additional Worker-local guard.
5. Never add real Renvix application assets, analytics, cookies, redirects, or
   the real administration hostname to this Worker.

Every external page path returns the same decoy shell. The client script and
telemetry endpoint are same-origin Worker routes. The signed internal probe at
`/.well-known/renvix-security-probe` now verifies the complete Worker → API
signature and network path without creating a security incident.
