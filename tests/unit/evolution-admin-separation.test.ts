import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_EVOLUTION_POLICY,
  calculateEvolutionRisk,
  evolutionDelayedSchedule,
  evolutionDuplicateHash,
  validateEvolutionMessage
} from "../../src/server/evolution-sending-policy.js";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const repository = read("src/server/whatsapp-repository.js");
const queue = read("src/server/message-queue.js");
const securityScore = read("src/server/security-score.js");
const adminAuth = read("src/server/admin-auth.js");
const adminUi = read("src/components/admin/AdminSections.jsx");
const migration = read("drizzle/0056_evolution_admin_sending_policies.sql");

describe("strict Meta and Evolution Admin separation", () => {
  it("limits every tenant channel query to official Meta providers", () => {
    expect(repository.match(/provider IN \('meta', 'meta_cloud', 'meta_cloud_api'\)/g)?.length).toBeGreaterThanOrEqual(3);
    expect(repository).not.toMatch(/tenantChannels[\s\S]*provider IN \([^)]*evolution/);
  });

  it("allows administrative channel creation only for evolution_admin", () => {
    expect(repository).toContain("provider = \"evolution_admin\"");
    expect(repository).toContain("if (!['evolution_admin'].includes(provider))");
  });

  it("keeps account security scoring on Meta and account controls", () => {
    expect(securityScore).toContain("wc.provider IN ('meta','meta_cloud','meta_cloud_api')");
    expect(securityScore).toContain("accountProtection:");
    expect(securityScore).not.toContain("evolution_sending_policies");
  });

  it("keeps Evolution management behind granular admin permissions", () => {
    for (const permission of ["view", "create", "pair", "manage_policy", "reconnect", "logout", "delete"]) {
      expect(adminAuth).toContain(`\"${permission}\"`);
    }
    expect(adminUi).toContain("/api/admin/evolution/devices");
    expect(adminUi).toContain("أجهزة الإدارة فقط");
  });

  it("migrates legacy Evolution rows to an explicit admin provider and seeds per-device policies", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS evolution_sending_policies");
    expect(migration).toContain("evolution_device_id uuid NOT NULL UNIQUE");
    expect(migration).toContain("SET provider = 'evolution_admin'");
    expect(migration).toContain("ON CONFLICT (evolution_device_id) DO NOTHING");
  });

  it("routes Meta immediately without applying Evolution delay policy", () => {
    expect(queue).toContain('delayReason: "meta_provider_queue"');
    expect(queue).toContain("const evolutionSchedule = isEvolutionAdmin");
    expect(queue).toContain('delayReason: "evolution_device_policy"');
  });
});

describe("Evolution Admin sending policy", () => {
  it("uses conservative per-device defaults", () => {
    expect(DEFAULT_EVOLUTION_POLICY).toMatchObject({
      baseDelaySeconds: 300,
      jitterMinSeconds: 270,
      jitterMaxSeconds: 330,
      hourlyLimit: 20,
      dailyLimit: 100,
      duplicateWindowSeconds: 86400
    });
  });

  it("creates a delayed queue timestamp without sleeping", () => {
    const result = evolutionDelayedSchedule(DEFAULT_EVOLUTION_POLICY, Date.parse("2026-08-03T12:00:00Z"), () => 0.5);
    expect(result.delaySeconds).toBe(300);
    expect(result.scheduledFor.toISOString()).toBe("2026-08-03T12:05:00.000Z");
  });

  it("classifies risk and recommends an operational action", () => {
    expect(calculateEvolutionRisk({ failureRate: 0, webhookHealthy: true })).toMatchObject({ riskLevel: "low", action: "continue" });
    expect(calculateEvolutionRisk({ failureRate: 1, disconnects24h: 3, webhookHealthy: false, status: "error" })).toMatchObject({ riskLevel: "critical", action: "pause_device" });
  });

  it("rejects invalid recipients, unsafe links, and malformed template variables", () => {
    expect(validateEvolutionMessage({ destination: "12", messageBody: "hello", policy: DEFAULT_EVOLUTION_POLICY })).toMatchObject({ ok: false, reason: "invalid_recipient" });
    expect(validateEvolutionMessage({ destination: "966512345678", messageBody: "http://unsafe.test", policy: DEFAULT_EVOLUTION_POLICY })).toMatchObject({ ok: false, reason: "unsafe_link" });
    expect(validateEvolutionMessage({ destination: "966512345678", messageBody: "مرحبا {{name", policy: DEFAULT_EVOLUTION_POLICY })).toMatchObject({ ok: false, reason: "invalid_template_variables" });
  });

  it("creates stable device-recipient-content duplicate keys", () => {
    const input = { instanceId: "admin-1", recipient: "966512345678", content: "hello" };
    expect(evolutionDuplicateHash(input)).toBe(evolutionDuplicateHash(input));
    expect(evolutionDuplicateHash(input)).not.toBe(evolutionDuplicateHash({ ...input, recipient: "966500000000" }));
  });
});
