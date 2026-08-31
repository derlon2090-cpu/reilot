import { createRemoteJWKSet, jwtVerify } from "jose";

const remoteKeySets = new Map();

function normalizeTeamDomain(value) {
  const candidate = String(value || "").trim();
  if (!candidate) throw new Error("CLOUDFLARE_ACCESS_TEAM_DOMAIN is required");

  let url;
  try {
    url = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
  } catch {
    throw new Error("CLOUDFLARE_ACCESS_TEAM_DOMAIN is invalid");
  }

  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== "https:"
    || url.username
    || url.password
    || url.pathname !== "/"
    || url.search
    || url.hash
    || !hostname.endsWith(".cloudflareaccess.com")) {
    throw new Error("CLOUDFLARE_ACCESS_TEAM_DOMAIN must be a Cloudflare Access HTTPS team domain");
  }
  return hostname;
}

function normalizeAudiences(value) {
  const audiences = String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!audiences.length) throw new Error("CLOUDFLARE_ACCESS_AUD is required");
  if (audiences.some((audience) => audience.length > 512)) {
    throw new Error("CLOUDFLARE_ACCESS_AUD is invalid");
  }
  return [...new Set(audiences)];
}

export function cloudflareAccessConfig(env = process.env) {
  const teamDomain = normalizeTeamDomain(env.CLOUDFLARE_ACCESS_TEAM_DOMAIN);
  const audiences = normalizeAudiences(env.CLOUDFLARE_ACCESS_AUD);
  const issuer = `https://${teamDomain}`;
  return {
    teamDomain,
    issuer,
    audiences,
    jwksUrl: new URL("/cdn-cgi/access/certs", issuer)
  };
}

function remoteKeySet(url) {
  const key = url.toString();
  let keySet = remoteKeySets.get(key);
  if (!keySet) {
    keySet = createRemoteJWKSet(url, {
      cooldownDuration: 30_000,
      cacheMaxAge: 10 * 60_000,
      timeoutDuration: 5_000
    });
    remoteKeySets.set(key, keySet);
  }
  return keySet;
}

function failure(reason, status) {
  return { ok: false, reason, status };
}

export async function verifyCloudflareAccessRequest(request, env = process.env, { jwks } = {}) {
  let config;
  try {
    config = cloudflareAccessConfig(env);
  } catch {
    return failure("cloudflare_access_not_configured", 503);
  }

  const assertion = String(request.headers.get("cf-access-jwt-assertion") || "").trim();
  if (!assertion) return failure("cloudflare_access_required", 403);

  try {
    const result = await jwtVerify(assertion, jwks || remoteKeySet(config.jwksUrl), {
      issuer: config.issuer,
      audience: config.audiences,
      algorithms: ["RS256"],
      clockTolerance: 5
    });
    return { ok: true, payload: result.payload };
  } catch {
    return failure("cloudflare_access_invalid", 403);
  }
}

export function resetCloudflareAccessKeyCacheForTests() {
  remoteKeySets.clear();
}
