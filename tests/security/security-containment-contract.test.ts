import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("security containment contract", () => {
  it("stores opaque independent block targets with expiration and incident association", () => {
    const migration = read("drizzle/0093_security_notifications_and_blocks.sql");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS security_blocks");
    expect(migration).toMatch(/target_type[\s\S]*account[\s\S]*device[\s\S]*ip[\s\S]*session/);
    expect(migration).toContain("target_hash text NOT NULL");
    expect(migration).toContain("expires_at timestamptz");
    expect(migration).toContain("incident_id uuid NOT NULL");
  });

  it("enforces blocks before host and authentication routing and never uses browser fingerprinting", () => {
    const middleware = read("middleware.js");
    const boundary = read("src/shared/security-block-boundary.js");
    expect(middleware.indexOf("const block = await checkSecurityBlockAtBoundary")).toBeLessThan(middleware.indexOf("const origins = configuredOrigins"));
    expect(boundary).toContain("__Host-rvx_trusted_browser");
    expect(boundary).toContain("access_unavailable");
    expect(`${middleware}\n${boundary}`).not.toMatch(/canvas|webgl|audiofingerprint/i);
  });

  it("prohibits permanent IP blocks in the server policy", () => {
    const center = read("src/server/security-center.js");
    expect(center).toContain("permanent IP blocks are prohibited");
    expect(center).toContain("IP containment requires high risk");
  });
});
