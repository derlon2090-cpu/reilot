# Google authentication setup

Renvix uses Google Identity Services on `accounts.renvix.app`. The browser receives a Google ID credential, while the Renvix backend verifies it with Google's official library before creating the normal Renvix session.

## Required environment variables

- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET` (server-only; required by the authorization-code fallback when a browser blocks the Google Identity Services script)

`NEXT_PUBLIC_GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_ID` must contain the same Web application client ID. Never expose `GOOGLE_CLIENT_SECRET` to the browser.

## Google Cloud Console

1. Configure the OAuth consent screen with the Renvix application name, verified domain, privacy policy, and terms URLs.
2. Create an OAuth 2.0 Client ID of type **Web application**.
3. Add the authorized JavaScript origin `https://accounts.renvix.app`.
4. Optionally add `http://localhost:3000` only for local development.
5. Add the authorized redirect URI `https://accounts.renvix.app/api/auth/google/callback` for the secure server fallback.
6. Keep the requested identity scopes limited to the standard profile, email, and OpenID claims.

The official GIS button is the primary flow. If a privacy extension blocks `https://accounts.google.com/gsi/client`, the same button falls back to the authorization-code route. That fallback requires both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the **Production** environment followed by a full redeploy.

After updating Production environment variables, perform a full Production redeploy. Google accounts are linked by the stable Google `sub` claim; Google credentials and tokens are never stored.
