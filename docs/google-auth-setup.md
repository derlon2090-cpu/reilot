# Google authentication architecture

Google authentication is owned by the Node.js backend on Render. Vercel renders the authentication UI but never receives or reads `GOOGLE_CLIENT_SECRET`.

## Environment ownership

Vercel/frontend:

- `NEXT_PUBLIC_API_BASE_URL=https://api.renvix.app` (a public URL, not a credential)

Render/backend:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `API_PUBLIC_URL=https://api.renvix.app`
- `AUTH_BACKEND_RUNTIME=render`
- `APP_URL=https://renvix.app`
- `AUTH_URL=https://accounts.renvix.app`
- `AUTH_COOKIE_DOMAIN=.renvix.app`

Render is the single source of truth for the Google Web OAuth client ID. Its config endpoint returns the normalized public client ID to the browser; the client secret, ID tokens, and authorization codes remain server-only and are never logged. Do not prefix `GOOGLE_CLIENT_ID` with `https://`; the backend accepts and normalizes that legacy mistake, but the canonical value is `123...apps.googleusercontent.com`.

## Production routing requirements

Attach a custom hostname under the shared cookie domain (recommended: `api.renvix.app`) to the Render service. A raw `*.onrender.com` hostname cannot set a cookie for `.renvix.app`.

The hostname must resolve publicly before deploying the frontend. Configure `api.renvix.app` as the custom domain in Render, add the DNS record Render provides, and verify that `https://api.renvix.app/api/auth/google/config` returns HTTP 200 with an `Origin: https://accounts.renvix.app` request. A missing DNS record makes every Google flow fail before any Render secret can be used.

The Google Cloud OAuth client must contain:

- JavaScript origins: `https://accounts.renvix.app`
- Server fallback redirect URI: `https://api.renvix.app/api/auth/google/callback`

If the public callback must remain `https://accounts.renvix.app/api/auth/google/callback`, configure an edge/path proxy for `/api/auth/google/*` to Render. DNS alone cannot route only that path. The code exchange still executes only on Render.

## Request flow

Primary GIS flow:

1. Browser on `accounts.renvix.app` loads Google Identity Services using the public client ID.
2. Browser requests the public Client ID and a nonce from `api.renvix.app`.
3. Google returns an ID credential to the browser.
4. Browser sends the credential to `api.renvix.app/api/auth/google` with credentials enabled.
5. Render verifies the credential, creates the Renvix session, and sets the shared `.renvix.app` cookie.
6. The portal redirects to `renvix.app/dashboard`.

Blocked-SDK fallback:

1. The UI reports that a browser extension blocked Google and offers Retry.
2. The optional secure-page button opens `api.renvix.app/api/auth/google/start`.
3. Google redirects only to the Render callback.
4. Render exchanges the code with `GOOGLE_CLIENT_SECRET`, creates the session, and redirects to the dashboard.

Vercel routes fail closed or redirect to the configured Render public origin; they never perform the authorization-code exchange.
