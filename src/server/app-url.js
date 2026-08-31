const LOCAL_URL = "http://localhost:3000";

const URL_CONFIG = Object.freeze({
  app: { keys: ["NEXT_PUBLIC_APP_URL", "APP_URL"], label: "Dashboard" },
  auth: { keys: ["NEXT_PUBLIC_AUTH_URL", "AUTH_URL", "BETTER_AUTH_URL"], label: "Authentication" },
  admin: { keys: ["NEXT_PUBLIC_ADMIN_URL", "ADMIN_URL"], label: "Administration" },
  site: { keys: ["NEXT_PUBLIC_SITE_URL", "SITE_URL"], label: "Public site" }
});

function configuredValue(keys, env) {
  for (const key of keys) {
    const value = String(env[key] || "").trim();
    if (value) return value;
  }
  return "";
}

function configuredBaseUrl(kind, env = process.env) {
  const config = URL_CONFIG[kind];
  const production = env.NODE_ENV === "production";
  const value = configuredValue(config.keys, env);
  if (!value && production) {
    throw new Error(`${config.label} URL is required in production (${config.keys[0]})`);
  }

  let parsed;
  try {
    parsed = new URL(value || LOCAL_URL);
  } catch {
    throw new Error(`${config.label} URL is invalid`);
  }

  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error(`${config.label} URL is not safe`);
  }
  if (production && parsed.protocol !== "https:") {
    throw new Error(`${config.label} URL must use HTTPS in production`);
  }
  if (production && (parsed.hostname.endsWith(".vercel.app") || ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname))) {
    throw new Error(`${config.label} URL must use its canonical production domain`);
  }
  return parsed.origin;
}

export function appBaseUrl(env = process.env) {
  return configuredBaseUrl("app", env);
}

export const dashboardBaseUrl = appBaseUrl;

export function adminBaseUrl(env = process.env) {
  return configuredBaseUrl("admin", env);
}

export function siteBaseUrl(env = process.env) {
  return configuredBaseUrl("site", env);
}

export function authBaseUrl(env = process.env) {
  return configuredBaseUrl("auth", env);
}

export function authPageUrl(pathname = "/login", returnTo = "", env = process.env) {
  const url = new URL(pathname, authBaseUrl(env));
  if (returnTo) url.searchParams.set("returnTo", returnTo);
  return url.toString();
}

export function adminPageUrl(pathname = "/advanced-pro-control", env = process.env) {
  return new URL(pathname, adminBaseUrl(env)).toString();
}

export function sitePageUrl(pathname = "/", env = process.env) {
  return new URL(pathname, siteBaseUrl(env)).toString();
}
