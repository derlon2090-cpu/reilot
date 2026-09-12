import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import honeypotWorker from "../../deploy/cloudflare/admin-honeypot/src/worker.js";

const root = process.cwd();
const workerSource = fs.readFileSync(path.join(root, "deploy/cloudflare/admin-honeypot/src/worker.js"), "utf8");
const pageSource = fs.readFileSync(path.join(root, "deploy/cloudflare/admin-honeypot/src/page.js"), "utf8");
const migration = fs.readFileSync(path.join(root, "drizzle/0091_security_operations_center.sql"), "utf8");
const ingestion = fs.readFileSync(path.join(root, "app/api/security/ingest/honeypot/route.js"), "utf8");
const alertMigration = fs.readFileSync(path.join(root, "drizzle/0092_honeypot_first_alerts.sql"), "utf8");
const workerConfig = fs.readFileSync(path.join(root, "deploy/cloudflare/admin-honeypot/wrangler.toml"), "utf8");

function runtime() {
  const pending: Promise<unknown>[] = [];
  return {
    pending,
    context: { waitUntil(promise: Promise<unknown>) { pending.push(promise); } },
    env: {
      SECURITY_INGESTION_URL: "https://api.renvix.app/api/security/ingest/honeypot",
      HONEYPOT_INGESTION_SECRET: "a-long-independent-honeypot-secret"
    }
  };
}

describe("isolated admin honeypot", () => {
  it("serves one self-contained decoy page for every external path and records the HTTP event", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
    const { pending, context, env } = runtime();
    try {
      let referenceBody = "";
      for (const requestedPath of ["/", "/.env", "/admin", "/login", "/random/path"]) {
        const response = await honeypotWorker.fetch(new Request(`https://admin.renvix.app${requestedPath}`, {
          headers: { "cf-connecting-ip": "203.0.113.10", "user-agent": "test-agent" }
        }), env, context);
        const body = await response.text();
        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain("text/html");
        expect(response.headers.get("content-security-policy")).toContain("script-src 'self'");
        expect(body).toContain('data-honeypot-shell="v2"');
        expect(body).toContain("/__renvix/honeypot.js");
        expect(body).toContain("/__renvix/pixel.gif");
        expect(body).not.toContain("<form");
        expect(body).not.toContain('type="password"');
        if (!referenceBody) referenceBody = body;
        expect(body).toBe(referenceBody);
      }
      await Promise.all(pending);
      expect(fetchSpy).toHaveBeenCalledTimes(5);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("serves bounded interaction telemetry without presenting or reading credentials", async () => {
    const { context, env } = runtime();
    const response = await honeypotWorker.fetch(new Request("https://admin.renvix.app/__renvix/honeypot.js"), env, context);
    const script = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/javascript");
    expect(script).toContain('addEventListener("pointermove"');
    expect(script).toContain('addEventListener("pointerdown"');
    expect(script).toContain('addEventListener("scroll"');
    expect(script).toContain('addEventListener("keydown"');
    expect(script).toContain('credentials: "same-origin"');
    expect(script).toContain('location.replace(location.pathname)');
    expect(script).not.toContain('transmit("login_attempt"');
    expect(script).not.toContain(".value");
    expect(script).not.toMatch(/clipboard|getUserMedia|geolocation\.getCurrentPosition/i);
  });

  it("serves a same-origin tracking pixel without accessing device files", async () => {
    const { context, env } = runtime();
    const response = await honeypotWorker.fetch(new Request("https://admin.renvix.app/__renvix/pixel.gif"), env, context);
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/gif");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(bytes.length).toBeGreaterThan(20);
  });

  it("accepts same-origin telemetry, strips unknown fields, and signs it server-side", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
    const { pending, context, env } = runtime();
    try {
      const request = new Request("https://admin.renvix.app/__renvix/telemetry", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://admin.renvix.app", "cf-connecting-ip": "203.0.113.10", "user-agent": "test-agent" },
        body: JSON.stringify({
          kind: "login_attempt", visitId: "visit-12345678", pagePath: "/login?secret=no",
          password: "must-not-leak", identity: "must-not-leak@example.test",
          device: { screenWidth: 1440, screenHeight: 900, platform: "Windows", timezone: "Asia/Riyadh" },
          interaction: { mouseMoves: 27, mouseDistance: 912, clicks: 3, keyPresses: 14, loginAttempts: 1, heatmap: [1, 2, 3] }
        })
      });
      Object.defineProperty(request, "cf", { value: {
        country: "SA", region: "Riyadh", city: "Riyadh", latitude: "24.7136", longitude: "46.6753",
        postalCode: "11564", continent: "AS", asn: 12345, asOrganization: "Example ISP"
      } });
      const response = await honeypotWorker.fetch(request, env, context);
      expect(response.status).toBe(204);
      expect(response.headers.get("set-cookie")).toMatch(/^__Host-renvix_hp_device=hpd_[a-f0-9]{32}\.[a-f0-9]{64};/);
      expect(response.headers.get("set-cookie")).toContain("renvix_honeypot_device=hpd_");
      expect(response.headers.get("set-cookie")).toContain("Domain=renvix.app");
      await Promise.all(pending);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [, init] = fetchSpy.mock.calls[0];
      const body = String(init?.body);
      const event = JSON.parse(body);
      expect(event.requested_path).toBe("/login");
      expect(event.honeypot_device_id).toMatch(/^hpd_[a-f0-9]{32}$/);
      expect(event.auto_block_device).toBe(false);
      expect(event.telemetry).toMatchObject({
        kind: "login_attempt", visitId: "visit-12345678",
        interaction: { mouseMoves: 27, clicks: 3, keyPresses: 14, loginAttempts: 1 }
      });
      expect(event.ip_location).toMatchObject({ latitude: 24.7136, longitude: 46.6753, accuracy: "ip_approximate" });
      expect(body).not.toContain("must-not-leak");
      const headers = new Headers(init?.headers);
      const timestamp = headers.get("x-renvix-timestamp") || "";
      const expected = crypto.createHmac("sha256", env.HONEYPOT_INGESTION_SECRET).update(`${timestamp}.${body}`).digest("hex");
      expect(headers.get("x-renvix-signature")).toBe(expected);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("requests automatic device containment only for the first external page response", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
    const { pending, context, env } = runtime();
    try {
      const first = await honeypotWorker.fetch(new Request("https://admin.renvix.app/portal", {
        headers: { "cf-connecting-ip": "203.0.113.11", "user-agent": "test-agent" }
      }), env, context);
      expect(first.status).toBe(200);
      await Promise.all(pending);
      const event = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
      expect(event.honeypot_device_id).toMatch(/^hpd_[a-f0-9]{32}$/);
      expect(event.auto_block_device).toBe(true);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("issues a signed Host-Only device ID and denies a blocked identifier", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
    const { pending, context, env } = runtime();
    try {
      const first = await honeypotWorker.fetch(new Request("https://admin.renvix.app/login", {
        headers: { "cf-connecting-ip": "203.0.113.10", "user-agent": "test-agent" }
      }), env, context);
      const cookie = String(first.headers.get("set-cookie") || "").split(";")[0];
      const deviceId = cookie.split("=")[1].split(".")[0];
      expect(cookie).toMatch(/^__Host-renvix_hp_device=hpd_[a-f0-9]{32}\.[a-f0-9]{64}$/);
      await Promise.all(pending);
      fetchSpy.mockClear();
      fetchSpy.mockImplementation(async (url, init) => {
        expect(String(url)).toBe("https://api.renvix.app/api/security/block-check");
        expect(JSON.parse(String(init?.body))).toEqual({ honeypotDeviceId: deviceId });
        expect(new Headers(init?.headers).get("x-security-signature")).toMatch(/^[a-f0-9]{64}$/);
        return new Response(JSON.stringify({ ok: true, blocked: true, referenceId: "SEC-DEVICE-1" }), {
          status: 200, headers: { "content-type": "application/json" }
        });
      });
      const blocked = await honeypotWorker.fetch(new Request("https://admin.renvix.app/login", {
        headers: { cookie, "cf-connecting-ip": "203.0.113.10", "user-agent": "test-agent" }
      }), env, context);
      expect(blocked.status).toBe(403);
      const blockedBody = await blocked.text();
      expect(blockedBody).toContain("تم حظر الوصول");
      expect(blockedBody).toContain("مراجعة الحظر مع الدعم");
      expect(blockedBody).toContain("SEC-DEVICE-1");
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("rejects cross-origin telemetry without forwarding it", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
    const { context, env } = runtime();
    try {
      const response = await honeypotWorker.fetch(new Request("https://admin.renvix.app/__renvix/telemetry", {
        method: "POST", headers: { origin: "https://attacker.example", "cf-connecting-ip": "203.0.113.10" }, body: "{}"
      }), env, context);
      expect(response.status).toBe(204);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("uses the signed internal probe to verify the complete Worker-to-API path", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
    const { context, env } = runtime();
    try {
      const timestamp = Date.now().toString();
      const signature = crypto.createHmac("sha256", env.HONEYPOT_INGESTION_SECRET)
        .update(`${timestamp}.GET./.well-known/renvix-security-probe`).digest("hex");
      const response = await honeypotWorker.fetch(new Request(
        "https://admin.renvix.app/.well-known/renvix-security-probe",
        { headers: { "x-renvix-probe-timestamp": timestamp, "x-renvix-probe-signature": signature } }
      ), env, context);
      expect(response.status).toBe(204);
      expect(await response.text()).toBe("");
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(String(fetchSpy.mock.calls[0][1]?.body)).toBe('{"internal_probe":true}');
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("never serves or reveals the real admin surface", () => {
    const combined = `${workerSource}\n${pageSource}`;
    expect(combined).not.toContain("wa-admin.renvix.app");
    expect(combined).not.toContain("/_next/");
    expect(combined).not.toContain("advanced-pro-control");
    expect(combined).not.toContain("renvix_admin_session");
    expect(combined).not.toMatch(/redirect\s*\(/i);
    expect(pageSource).not.toContain("https://");
    expect(pageSource).not.toContain("document.cookie");
    expect(pageSource).not.toContain("<form");
    expect(pageSource).not.toContain('type="password"');
  });

  it("uses Cloudflare trusted context instead of spoofable forwarding headers", () => {
    expect(workerSource).toContain('request.headers.get("cf-connecting-ip")');
    expect(workerSource).not.toContain('request.headers.get("x-forwarded-for")');
    expect(workerSource).toContain("request.cf");
  });

  it("sends query keys without query values and applies strict field bounds", () => {
    expect(workerSource).toContain("[...url.searchParams.keys()]");
    expect(workerSource).not.toContain("searchParams.entries");
    expect(workerSource).toContain("MAX_TELEMETRY_BYTES");
    expect(workerSource).toContain("slice(0, 30)");
  });

  it("requires a signed bounded server-side ingestion request", () => {
    expect(ingestion).toContain("verifySignedIngestion");
    expect(ingestion).toContain("ingestHoneypotEvent");
    expect(ingestion).toContain("16_384");
    expect(ingestion).not.toContain('request.headers.get("x-forwarded-for")');
    expect(workerConfig).toContain('SECURITY_INGESTION_URL = "https://api.renvix.app/api/security/ingest/honeypot"');
  });

  it("keeps the scanner lock and audit ledger tamper evident", () => {
    expect(migration).toContain("inspector_runs_single_active_idx");
    expect(migration).toContain("security_event_ledger_no_update");
    expect(migration).toContain("append-only");
    expect(migration).toContain("REVOKE UPDATE, DELETE, TRUNCATE");
    expect(alertMigration).toContain("'INFO','LOW','MEDIUM','HIGH','CRITICAL'");
  });
});
