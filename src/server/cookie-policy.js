export function secureCookieEnabled() {
  const publicUrl = process.env.AUTH_URL || process.env.APP_URL || process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  return process.env.COOKIE_SECURE !== "false"
    && (process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production" || publicUrl.startsWith("https://"));
}

export function sharedCookieDomainAttribute() {
  const configured = String(process.env.AUTH_COOKIE_DOMAIN || "").trim().toLowerCase();
  if (!configured) return "";
  const normalized = configured.startsWith(".") ? configured.slice(1) : configured;
  if (normalized === "localhost" || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(normalized)) {
    throw new Error("AUTH_COOKIE_DOMAIN is invalid");
  }
  return `; Domain=.${normalized}`;
}
