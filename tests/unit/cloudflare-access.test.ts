import { beforeAll, describe, expect, it } from "vitest";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import {
  cloudflareAccessConfig,
  verifyCloudflareAccessRequest
} from "../../src/shared/cloudflare-access.js";

const env = {
  NODE_ENV: "production",
  CLOUDFLARE_ACCESS_TEAM_DOMAIN: "aged-base-982a.cloudflareaccess.com",
  CLOUDFLARE_ACCESS_AUD: "renvix-admin-audience"
} as NodeJS.ProcessEnv;

let privateKey: Awaited<ReturnType<typeof generateKeyPair>>["privateKey"];
let jwks: ReturnType<typeof createLocalJWKSet>;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  const publicJwk = await exportJWK(pair.publicKey);
  jwks = createLocalJWKSet({ keys: [{ ...publicJwk, kid: "test-key", alg: "RS256", use: "sig" }] });
});

async function token({
  issuer = "https://aged-base-982a.cloudflareaccess.com",
  audience = "renvix-admin-audience",
  expiresAt = Math.floor(Date.now() / 1000) + 300
} = {}) {
  return new SignJWT({ email: "admin@example.test" })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject("access-user")
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(privateKey);
}

function request(assertion = "") {
  return new Request("https://wa-admin.renvix.app/admin", {
    headers: assertion ? { "Cf-Access-Jwt-Assertion": assertion } : {}
  });
}

describe("Cloudflare Access JWT validation", () => {
  it("uses the official team JWKS endpoint and server-only audience", () => {
    expect(cloudflareAccessConfig(env)).toMatchObject({
      issuer: "https://aged-base-982a.cloudflareaccess.com",
      audiences: ["renvix-admin-audience"]
    });
    expect(cloudflareAccessConfig(env).jwksUrl.toString()).toBe(
      "https://aged-base-982a.cloudflareaccess.com/cdn-cgi/access/certs"
    );
  });

  it("accepts a correctly signed, unexpired token with the expected issuer and AUD", async () => {
    const result = await verifyCloudflareAccessRequest(request(await token()), env, { jwks });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.payload.sub).toBe("access-user");
  });

  it("rejects missing, expired, wrong-issuer, and wrong-audience assertions", async () => {
    expect(await verifyCloudflareAccessRequest(request(), env, { jwks })).toMatchObject({
      ok: false, reason: "cloudflare_access_required", status: 403
    });

    const expired = await token({ expiresAt: Math.floor(Date.now() / 1000) - 60 });
    const wrongIssuer = await token({ issuer: "https://other.cloudflareaccess.com" });
    const wrongAudience = await token({ audience: "another-application" });
    for (const assertion of [expired, wrongIssuer, wrongAudience]) {
      expect(await verifyCloudflareAccessRequest(request(assertion), env, { jwks })).toMatchObject({
        ok: false, reason: "cloudflare_access_invalid", status: 403
      });
    }
  });

  it("fails closed when required production configuration is absent or unsafe", async () => {
    expect(await verifyCloudflareAccessRequest(request(await token()), {
      ...env,
      CLOUDFLARE_ACCESS_AUD: ""
    }, { jwks })).toMatchObject({
      ok: false, reason: "cloudflare_access_not_configured", status: 503
    });
    expect(() => cloudflareAccessConfig({
      ...env,
      CLOUDFLARE_ACCESS_TEAM_DOMAIN: "https://attacker.example"
    })).toThrow("Cloudflare Access HTTPS team domain");
  });
});
