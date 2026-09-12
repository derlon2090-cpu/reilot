# Renvix admin honeypot

This Cloudflare Worker is isolated from the real Renvix application and admin
deployment. It serves a self-contained administrative session-check shell and sends bounded,
signed security events to the existing ingestion service.

The browser telemetry is intentionally aggregated. It includes device and
viewport characteristics plus counts for pointer movement, clicks, scrolling,
and key presses. It contains no sign-in form and never asks for credentials. It
never reads or sends input values,
passwords, cookies, clipboard data, camera, microphone, or precise geolocation.
The server derives a peppered probabilistic device fingerprint and a confidence
level from bounded browser signals. Cloudflare IP geolocation is stored as an
approximate location; it is not GPS. Private/incognito browsing usually keeps
these hardware signals but can deliberately reduce or randomize them, so the
fingerprint must not be treated as a cryptographic device identity.

The Worker also issues a server-signed `Renvix Device ID` in an HttpOnly,
Secure, SameSite=Strict, Host-Only cookie. A second signed marker scoped to
`renvix.app` carries the same pseudonymous ID so the central middleware can
enforce an active block on the public Renvix hosts. Neither cookie contains
personal data. The ID is shown in the Security Center and can be contained
through the existing device block scope.
It is not a hardware serial number: clearing site data or closing an incognito
session can cause the browser to receive a new ID. Every request carrying a
valid signed ID is checked against active blocks before the decoy is served.
The first external page response also requests an automatic, device-only
preventive block in the same database transaction as the incident. Later page
requests carrying that signed ID receive a professional block notice and a
support-review reference. IP blocking is never automatic because shared IPs can
belong to unrelated users.
After the initial bounded telemetry acknowledgement, the session-check shell
replaces itself with that block notice so the first visit does not remain on a
credential-like screen.

The hidden same-origin 1x1 pixel only confirms that the page resource was
requested and helps issue the signed ID. It cannot enter the device, inspect
files, obtain a hardware serial, or read browser history. The Security Center
can show the five most recent Renvix host/path attempts associated with the
signed marker, but no website can read browsing history from unrelated domains.

Deployment requirements:

1. Keep `admin.renvix.app` proxied by Cloudflare and public; do not attach a
   Zero Trust Access policy to this hostname.
2. Keep `wa-admin.renvix.app` behind Cloudflare Zero Trust.
3. Set the Worker secret with `wrangler secret put HONEYPOT_INGESTION_SECRET`
   and set the same server-only value on the ingestion service.
   Keep `SECURITY_INGESTION_URL` on the Render backend origin
   (`https://api.renvix.app/api/security/ingest/honeypot`).
4. Keep Cloudflare WAF and zone rate limits enabled. The binding in
   `wrangler.toml` is an additional Worker-local guard.
5. Never add real Renvix application assets, analytics, cookies, redirects, or
   the real administration hostname to this Worker.

Every external page path returns the same decoy shell. The client script and
telemetry endpoint are same-origin Worker routes. The signed internal probe at
`/.well-known/renvix-security-probe` now verifies the complete Worker → API
signature and network path without creating a security incident.
