import crypto from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  calculateThreatScore, incidentAlertDedupeKey, ingestHoneypotEvent, parseUserAgent, redactSecurityValue,
  remediationPolicy, severityForRisk, verifySignedIngestion
} from "../../src/server/security-center.js";
import { nextTenHourRun } from "../../src/server/security-inspector.js";

describe("security center risk and privacy policy", () => {
  afterEach(() => vi.useRealTimers());

  it("does not classify a single homepage visit as critical", () => {
    const score = calculateThreatScore({ requestedPath: "/", attempts: 1, distinctPaths: 1 });
    expect(score).toBe(10);
    expect(severityForRisk(score)).toBe("LOW");
  });

  it("raises a correlated honeypot, admin login, and MFA sequence", () => {
    const score = calculateThreatScore({
      requestedPath: "/.env", attempts: 5, distinctPaths: 4,
      correlatedEventTypes: ["ADMIN_HONEYPOT_ACCESS", "ADMIN_LOGIN_FAILED", "ADMIN_MFA_FAILED"]
    });
    expect(score).toBeGreaterThanOrEqual(80);
    expect(severityForRisk(score)).toBe("CRITICAL");
  });

  it("uses a graduated score for broad path scanning", () => {
    expect(calculateThreatScore({ requestedPath: "/", attempts: 20, distinctPaths: 1 })).toBe(45);
  });

  it("deduplicates repeated alerts while allowing severity escalation", () => {
    const low = incidentAlertDedupeKey({ id: "incident-1", severity: "LOW" }, "security@example.com");
    expect(incidentAlertDedupeKey({ id: "incident-1", severity: "LOW" }, "security@example.com")).toBe(low);
    expect(incidentAlertDedupeKey({ id: "incident-1", severity: "HIGH" }, "security@example.com")).not.toBe(low);
  });

  it("redacts secrets recursively and bounds attacker controlled fields", () => {
    const safe = redactSecurityValue({
      password: "never-store-me", nested: { authorization: "Bearer abc.def", note: "token=hello\n<script>alert(1)</script>" }
    }) as Record<string, unknown>;
    expect(safe.password).toBe("[redacted]");
    expect(JSON.stringify(safe)).not.toContain("abc.def");
    expect(JSON.stringify(safe)).not.toContain("token=hello");
    expect(JSON.stringify(safe)).not.toContain("\n");
  });

  it("reports device class rather than claiming a real device name", () => {
    expect(parseUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1"))
      .toMatchObject({ browser: "Safari", os: "iOS/iPadOS", deviceClass: "mobile" });
  });

  it("enforces the remediation allowlist and blocks destructive actions", () => {
    expect(remediationPolicy("retry_job")).toMatchObject({ allowed: true, requiresApproval: false });
    expect(remediationPolicy("temporary_block")).toMatchObject({ allowed: true, requiresApproval: true });
    expect(remediationPolicy("change_dns")).toMatchObject({ allowed: false, impactLevel: "prohibited" });
    expect(remediationPolicy("arbitrary_shell_command").allowed).toBe(false);
  });

  it("accepts only fresh correctly signed ingestion payloads", () => {
    const secret = "a-secure-test-secret-that-is-long-enough";
    const rawBody = JSON.stringify({ requested_path: "/login" });
    const timestamp = Date.now().toString();
    const signature = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
    expect(verifySignedIngestion({ rawBody, timestamp, signature, secret })).toBe(true);
    expect(verifySignedIngestion({ rawBody: `${rawBody}x`, timestamp, signature, secret })).toBe(false);
  });

  it("uses a fixed ten-hour cadence and prevents health probes from creating incidents", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-31T00:00:00.000Z"));
    expect(nextTenHourRun(new Date())).toEqual(new Date("2026-08-31T10:00:00.000Z"));
    await expect(ingestHoneypotEvent({ internal_probe: true })).resolves.toMatchObject({ ok: true, probe: true, incident: null });
  });
});
