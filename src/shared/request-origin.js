const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function mutationOriginAllowed(request, env = process.env) {
  if (SAFE_METHODS.has(String(request.method || 'GET').toUpperCase())) return true;
  const origin = request.headers.get('origin');
  const site = String(request.headers.get('sec-fetch-site') || '').toLowerCase();
  if (!origin) return site !== 'cross-site';
  if (origin === 'null') return site === 'same-origin';
  let parsed;
  try { parsed = new URL(origin); } catch { return false; }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin) return false;
  const target = new URL(request.url);
  const allowed = new Set([target.origin]);
  // The admin UI is served by Vercel while legacy /api rewrites send its
  // mutations to the Render API. Render may not carry the frontend URL env.
  // Keep this exception limited to the canonical API and admin origin.
  if (target.hostname === 'api.renvix.app'
    && target.pathname.startsWith('/api/admin/')) {
    allowed.add('https://wa-admin.renvix.app');
  }
  for (const value of [env.APP_URL, env.NEXT_PUBLIC_APP_URL, env.AUTH_URL, env.NEXT_PUBLIC_AUTH_URL,
    env.SITE_URL, env.NEXT_PUBLIC_SITE_URL, env.ADMIN_URL, env.NEXT_PUBLIC_ADMIN_URL,
    env.API_PUBLIC_URL, env.NEXT_PUBLIC_API_BASE_URL, env.BETTER_AUTH_URL,
    ...(env.TRUSTED_APP_ORIGINS || '').split(',')]) {
    try {
      const url = new URL(String(value || '').trim());
      if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) allowed.add(url.origin);
    } catch { /* Not configured. */ }
  }
  return allowed.has(origin);
}

export function mutationOriginResponse(request, env = process.env) {
  return mutationOriginAllowed(request, env) ? null : Response.json(
    { ok: false, reason: 'untrusted_request_origin' },
    { status: 403, headers: { 'Cache-Control': 'no-store' } }
  );
}
