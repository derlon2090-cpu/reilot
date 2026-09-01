import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import honeypotWorker from "../../deploy/cloudflare/admin-honeypot/src/worker.js";

const root = process.cwd();
const worker = fs.readFileSync(path.join(root, "deploy/cloudflare/admin-honeypot/src/worker.js"), "utf8");
const migration = fs.readFileSync(path.join(root, "drizzle/0091_security_operations_center.sql"), "utf8");
const ingestion = fs.readFileSync(path.join(root, "app/api/security/ingest/honeypot/route.js"), "utf8");
const alertMigration = fs.readFileSync(path.join(root, "drizzle/0092_honeypot_first_alerts.sql"), "utf8");

describe("isolated admin honeypot", () => {
  it("returns the same empty HTTP 200 response for every external path while recording events", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
    const pending: Promise<unknown>[] = [];
    const context = { waitUntil(promise: Promise<unknown>) { pending.push(promise); } };
    const env = {
      SECURITY_INGESTION_URL: "https://api.renvix.app/api/security/ingest/honeypot",
      HONEYPOT_INGESTION_SECRET: "a-long-independent-honeypot-secret"
    };
    try {
      for (const requestedPath of ["/", "/.env", "/admin", "/login", "/random/path"]) {
        const response = await honeypotWorker.fetch(new Request(`https://admin.renvix.app${requestedPath}`, {
          headers: { "cf-connecting-ip": "203.0.113.10", "user-agent": "test-agent" }
        }), env, context);
        expect(response.status).toBe(200);
        expect(await response.text()).toBe("");
        expect(response.headers.get("content-security-policy")).toContain("default-src 'none'");
      }
      await Promise.all(pending);
      expect(fetchSpy).toHaveBeenCalledTimes(5);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("keeps the signed internal health probe at HTTP 204", async () => {
    const secret = "a-long-independent-honeypot-secret";
    const timestamp = Date.now().toString();
    const signature = crypto.createHmac("sha256", secret)
      .update(`${timestamp}.GET./.well-known/renvix-security-probe`).digest("hex");
    const response = await honeypotWorker.fetch(new Request(
      "https://admin.renvix.app/.well-known/renvix-security-probe",
      { headers: { "x-renvix-probe-timestamp": timestamp, "x-renvix-probe-signature": signature } }
    ), { HONEYPOT_INGESTION_SECRET: secret }, { waitUntil: vi.fn() });
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
  });

  it("never serves or reveals the real admin surface", () => {
    expect(worker).not.toContain("wa-admin.renvix.app");
    expect(worker).not.toContain("/_next/");
    expect(worker).not.toContain("advanced-pro-control");
    expect(worker).not.toContain("renvix_admin_session");
    expect(worker).toContain('status === 204 ? null : ""');
    expect(worker).toContain("function neutralResponse(status = 200)");
    expect(worker).toContain("return neutralResponse()");
    expect(worker).not.toContain("neutralResponse(404)");
    expect(worker).not.toContain("rateLimited ? 429");
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
    expect(ingestion).toContain("processSecurityAlerts");
    expect(ingestion).toContain("16_384");
    expect(ingestion).not.toContain("request.headers.get(\"x-forwarded-for\")");
  });

  it("keeps the scanner lock and audit ledger tamper evident", () => {
    expect(migration).toContain("inspector_runs_single_active_idx");
    expect(migration).toContain("security_event_ledger_no_update");
    expect(migration).toContain("append-only");
    expect(migration).toContain("REVOKE UPDATE, DELETE, TRUNCATE");
    expect(alertMigration).toContain("'INFO','LOW','MEDIUM','HIGH','CRITICAL'");
  });
});
