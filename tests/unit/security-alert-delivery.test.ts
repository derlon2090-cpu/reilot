import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  transaction: vi.fn(),
  sendEmail: vi.fn()
}));

vi.mock("../../src/server/db.js", () => ({ query: mocks.query, transaction: mocks.transaction }));
vi.mock("../../src/lib/email/send-email.js", () => ({ sendEmail: mocks.sendEmail }));

import { processSecurityAlerts } from "../../src/server/security-center.js";

describe("security incident email delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SECURITY_ALERT_RECIPIENTS", "security@example.com");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("reconciles and sends an email for a critical honeypot incident", async () => {
    const incident = {
      id: "11111111-1111-4111-8111-111111111111",
      incident_type: "ADMIN_HONEYPOT_ACCESS",
      incident_number: "INC-2026-000193",
      title: "محاولة اكتشاف واجهة الإدارة",
      severity: "CRITICAL",
      risk_score: 81,
      affected_service: "admin-honeypot",
      first_seen: "2026-10-01T04:51:00.000Z",
      occurrence_count: 37,
      source_ip: "203.0.113.10",
      requested_path: "/admin"
    };
    let transactionNumber = 0;
    mocks.transaction.mockImplementation(async (callback: (client: { query: typeof mocks.query }) => Promise<unknown>) => {
      transactionNumber += 1;
      const client = {
        query: vi.fn(async (sql: string) => {
          if (sql.includes("SELECT * FROM security_incidents")) return { rows: [incident] };
          if (sql.includes("SELECT DISTINCT u.email")) return { rows: [] };
          if (sql.includes("FROM security_alert_deliveries sad")) {
            return transactionNumber === 1
              ? { rows: [{ ...incident, incident_id: incident.id, channel: "email", recipient: "security@example.com", dedupe_key: "alert-key" }], rowCount: 1 }
              : { rows: [], rowCount: 0 };
          }
          return { rows: [], rowCount: 0 };
        })
      };
      return callback(client);
    });
    mocks.query.mockResolvedValue({ rows: [], rowCount: 1 });
    mocks.sendEmail.mockResolvedValue({ id: "email-1" });

    await expect(processSecurityAlerts()).resolves.toEqual({ processed: 1, sent: 1, failed: 0 });
    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "security@example.com",
      subject: "[CRITICAL] INC-2026-000193 — محاولة اكتشاف واجهة الإدارة",
      idempotencyKey: "alert-key"
    }));
  });
});
