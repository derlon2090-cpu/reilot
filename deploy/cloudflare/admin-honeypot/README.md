# Renvix admin honeypot

This Worker is intentionally isolated from the Renvix application and admin
deployment. It always returns an empty, fixed response and never redirects or
serves application assets.

Deployment requirements:

1. Keep `admin.renvix.app` proxied by Cloudflare and public; do not attach a
   Zero Trust Access policy to this hostname.
2. Keep `wa-admin.renvix.app` behind Cloudflare Zero Trust.
3. Set the Worker secret with `wrangler secret put HONEYPOT_INGESTION_SECRET`
   and set the same server-only value on the ingestion service.
4. Keep Cloudflare WAF and zone rate limits enabled. The binding in
   `wrangler.toml` is an additional Worker-local guard.
5. Never add Renvix assets, analytics, cookies, client JavaScript, redirects,
   or the real administration hostname to this Worker.

The routes `/`, `/login`, `/api/admin`, `/.env`, `/config`, `/wp-admin`, and
every other path deliberately produce the same neutral response. The requested
path is sent only to the signed security ingestion endpoint for risk scoring.
