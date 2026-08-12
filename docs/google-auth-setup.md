# Google authentication setup

Renvix uses Google Identity Services on `accounts.renvix.app`. The browser receives a Google ID credential, while the Renvix backend verifies it with Google's official library before creating the normal Renvix session.

## Required environment variables

- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET` (server-only; reserved for future OAuth flows and not used by the current ID-token sign-in flow)

`NEXT_PUBLIC_GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_ID` must contain the same Web application client ID. Never expose `GOOGLE_CLIENT_SECRET` to the browser.

## Google Cloud Console

1. Configure the OAuth consent screen with the Renvix application name, verified domain, privacy policy, and terms URLs.
2. Create an OAuth 2.0 Client ID of type **Web application**.
3. Add the authorized JavaScript origin `https://accounts.renvix.app`.
4. Optionally add `http://localhost:3000` only for local development.
5. No redirect URI is required for the current Google Identity Services callback flow.
6. Keep the requested identity scopes limited to the standard profile, email, and OpenID claims.

After updating Production environment variables, perform a full Production redeploy. Google accounts are linked by the stable Google `sub` claim; Google credentials and tokens are never stored.
