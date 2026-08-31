function normalizedOrigin(value) {
  try {
    return value ? new URL(value).origin : "";
  } catch {
    return "";
  }
}

export function authAllowedOrigins(env = process.env) {
  return new Set([
    env.APP_URL,
    env.NEXT_PUBLIC_APP_URL,
    env.NEXT_PUBLIC_AUTH_URL,
    env.NEXT_PUBLIC_SITE_URL,
    env.SITE_URL,
    env.NEXT_PUBLIC_ADMIN_URL,
    env.ADMIN_URL,
    env.AUTH_URL,
    env.BETTER_AUTH_URL,
    env.NODE_ENV !== "production" ? "http://localhost:3000" : ""
  ].map(normalizedOrigin).filter(Boolean));
}

export function authCorsHeaders(req, env = process.env) {
  const origin = normalizedOrigin(req.headers.get("origin"));
  if (!origin || !authAllowedOrigins(env).has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin"
  };
}

export function authOriginAllowed(req, env = process.env) {
  const origin = req.headers.get("origin");
  return !origin || authAllowedOrigins(env).has(normalizedOrigin(origin));
}

export function authCorsPreflight(req, methods = "GET, POST, OPTIONS", env = process.env) {
  if (!authOriginAllowed(req, env)) return new Response(null, { status: 403 });
  return new Response(null, {
    status: 204,
    headers: {
      ...authCorsHeaders(req, env),
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": methods,
      "Access-Control-Max-Age": "600"
    }
  });
}
