const PRODUCTION_APP_URL = "https://renvix.app";
const PRODUCTION_AUTH_URL = "https://accounts.renvix.app";
const LOCAL_APP_URL = "http://localhost:3000";

export function appBaseUrl() {
  const configured = String(
    process.env.NEXT_PUBLIC_APP_URL
      || process.env.BETTER_AUTH_URL
      || (process.env.NODE_ENV === "production" ? PRODUCTION_APP_URL : LOCAL_APP_URL)
  ).trim();

  let parsed;
  try {
    parsed = new URL(configured);
  } catch {
    throw new Error("Application URL is invalid");
  }

  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    throw new Error("Application URL must use HTTPS in production");
  }
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error("Application URL is not safe");
  }
  return parsed.origin;
}

export function authBaseUrl() {
  return safeBaseUrl(process.env.AUTH_URL || (process.env.NODE_ENV === "production" ? PRODUCTION_AUTH_URL : appBaseUrl()), "Authentication");
}

export function authPageUrl(pathname = "/login", returnTo = "") {
  const url = new URL(pathname, authBaseUrl());
  if (returnTo) url.searchParams.set("returnTo", returnTo);
  return url.toString();
}

function safeBaseUrl(value, label) {
  let parsed;
  try { parsed = new URL(String(value || "").trim()); } catch { throw new Error(`${label} URL is invalid`); }
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") throw new Error(`${label} URL must use HTTPS in production`);
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error(`${label} URL is not safe`);
  return parsed.origin;
}
