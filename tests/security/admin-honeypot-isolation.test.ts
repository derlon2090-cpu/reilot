import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const worker = fs.readFileSync(path.join(root, "deploy/cloudflare/admin-honeypot/src/worker.js"), "utf8");
const migration = fs.readFileSync(path.join(root, "drizzle/0091_security_operations_center.sql"), "utf8");
const ingestion = fs.readFileSync(path.join(root, "app/api/security/ingest/honeypot/route.js"), "utf8");

describe("isolated admin honeypot", () => {
  it("never serves or reveals the real admin surface", () => {
    expect(worker).not.toContain("wa-admin.renvix.app");
    expect(worker).not.toContain("/_next/");
    expect(worker).not.toContain("advanced-pro-control");
    expect(worker).not.toContain("renvix_admin_session");
    expect(worker).toContain('status === 204 ? null : ""');
    expect(worker).not.toMatch(/redirect\s*\(/i);
  });

  it("uses Cloudflare trusted context instead of spoofable forwarding headers", () => {
    expect(worker).toContain('request.headers.get("cf-connecting-ip")');
    expect(worker).not.toContain('request.headers.get("x-forwarded-for")');
    expect(worker).toContain("request.cf");
  });

  it("sends query keys without query values and applies strict field bounds", () => {
    expect(worker).toContain("[...url.searchParams.keys()]");
    expect(worker).not.toContain("searchParams.entries");
    expect(worker).toContain("slice(0, 30)");
  });

  it("requires a signed bounded server-side ingestion request", () => {
    expect(ingestion).toContain("verifySignedIngestion");
    expect(ingestion).toContain("16_384");
    expect(ingestion).not.toContain("request.headers.get(\"x-forwarded-for\")");
  });

  it("keeps the scanner lock and audit ledger tamper evident", () => {
    expect(migration).toContain("inspector_runs_single_active_idx");
    expect(migration).toContain("security_event_ledger_no_update");
    expect(migration).toContain("append-only");
    expect(migration).toContain("REVOKE UPDATE, DELETE, TRUNCATE");
  });
});
