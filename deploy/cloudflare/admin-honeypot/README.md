# Renvix admin honeypot

This Cloudflare Worker is isolated from the real Renvix application and admin
deployment. It serves a self-contained decoy sign-in shell and sends bounded,
signed security events to the existing ingestion service.

The browser telemetry is intentionally aggregated. It includes device and
viewport characteristics plus counts for pointer movement, clicks, scrolling,
key presses, and decoy form submissions. It never reads or sends input values,
passwords, cookies, clipboard data, camera, microphone, or precise geolocation.
The server derives a peppered probabilistic device fingerprint and a confidence
level from bounded browser signals. Cloudflare IP geolocation is stored as an
approximate location; it is not GPS. Private/incognito browsing usually keeps
these hardware signals but can deliberately reduce or randomize them, so the
fingerprint must not be treated as a cryptographic device identity.

The Worker also issues a server-signed `Renvix Device ID` in an HttpOnly,
Secure, SameSite=Strict, Host-Only cookie. This pseudonymous ID is shown in the
Security Center and can be contained through the existing device block scope.
It is not a hardware serial number: clearing site data or closing an incognito
session can cause the browser to receive a new ID. Every request carrying a
valid signed ID is checked against active blocks before the decoy is served.

Deployment requirements:

1. Keep `admin.renvix.app` proxied by Cloudflare and public; do not attach a
   Zero Trust Access policy to this hostname.
2. Keep `wa-admin.renvix.app` behind Cloudflare Zero Trust.
3. Set the Worker secret with `wrangler secret put HONEYPOT_INGESTION_SECRET`
   and set the same server-only value on the ingestion service.
   Keep `SECURITY_INGESTION_URL` on the public Vercel application origin; the
   API hostname is not used because it serves the separate backend runtime.
4. Keep Cloudflare WAF and zone rate limits enabled. The binding in
   `wrangler.toml` is an additional Worker-local guard.
5. Never add real Renvix application assets, analytics, cookies, redirects, or
   the real administration hostname to this Worker.

Every external page path returns the same decoy shell. The client script and
telemetry endpoint are same-origin Worker routes. The signed internal probe at
`/.well-known/renvix-security-probe` now verifies the complete Worker → API
signature and network path without creating a security incident.
