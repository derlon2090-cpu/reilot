import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  query: vi.fn(),
  transaction: vi.fn()
}));
const mailer = vi.hoisted(() => ({
  sendSupportReplyEmail: vi.fn()
}));
const notifications = vi.hoisted(() => ({
  createInAppNotification: vi.fn()
}));

vi.mock("../../src/server/db.js", () => database);
vi.mock("../../src/server/email/resend.service.js", () => mailer);
vi.mock("../../src/server/in-app-notifications.js", () => notifications);

import { adminReply, createPublicTicket } from "../../src/server/support-tickets.js";

describe("public support ticket workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a visitor ticket and its first message in one transaction", async () => {
    const client = { query: vi.fn() };
    database.transaction.mockImplementation(async (callback) => callback(client));
    client.query
      .mockResolvedValueOnce({ rows: [{ count: 0 }] })
      .mockResolvedValueOnce({ rows: [{ value: 42 }] })
      .mockResolvedValueOnce({ rows: [{ id: "ticket-id" }] })
      .mockResolvedValueOnce({ rows: [{ id: "message-id" }] })
      .mockResolvedValueOnce({ rows: [] });

    const item = await createPublicTicket({
      name: "وليد علي",
      email: "waleed@example.com",
      type: "INQUIRY",
      subject: "طلب مساعدة جديد",
      body: "أحتاج إلى مساعدة في إعداد الحساب."
    }, { requestFingerprint: "hashed-request" });

    expect(item).toMatchObject({
      id: "ticket-id",
      messageId: "message-id",
      ticketNumber: expect.stringMatching(/^SUP-\d{4}-000042$/),
      requesterEmail: "waleed@example.com"
    });
    expect(client.query.mock.calls[2][0]).toContain("'public_support'");
    expect(client.query.mock.calls[2][1]).toContain("وليد علي");
    expect(client.query.mock.calls[3][0]).toContain("'USER'");
    expect(client.query.mock.calls[4][0]).toContain("'public_ticket_created'");
  });

  it("emails an admin reply and records the provider delivery id", async () => {
    const client = { query: vi.fn() };
    database.transaction.mockImplementation(async (callback) => callback(client));
    client.query
      .mockResolvedValueOnce({ rows: [{
        id: "ticket-id",
        tenant_id: null,
        created_by_user_id: null,
        requester_email: "visitor@example.com",
        requester_name: "زائر",
        ticket_number: "SUP-2026-000042",
        subject: "استفسار"
      }] })
      .mockResolvedValueOnce({ rows: [{ id: "reply-id" }] })
      .mockResolvedValueOnce({ rows: [] });
    mailer.sendSupportReplyEmail.mockResolvedValue({ id: "resend-email-id" });
    database.query.mockResolvedValue({ rows: [] });

    const result = await adminReply(
      { adminId: "admin-id" },
      "ticket-id",
      { body: "تمت مراجعة طلبك، ويمكنك المتابعة الآن.", internal: false }
    );

    expect(mailer.sendSupportReplyEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "visitor@example.com",
      ticketNumber: "SUP-2026-000042"
    }));
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining("email_delivery_status='sent'"),
      ["reply-id", "resend-email-id"]
    );
    expect(result.emailDelivery).toEqual({ status: "sent", providerId: "resend-email-id" });
    expect(notifications.createInAppNotification).not.toHaveBeenCalled();
  });

  it("never emails internal admin notes", async () => {
    const client = { query: vi.fn() };
    database.transaction.mockImplementation(async (callback) => callback(client));
    client.query
      .mockResolvedValueOnce({ rows: [{
        id: "ticket-id",
        tenant_id: null,
        created_by_user_id: null,
        requester_email: "visitor@example.com"
      }] })
      .mockResolvedValueOnce({ rows: [{ id: "note-id" }] });

    const result = await adminReply(
      { adminId: "admin-id" },
      "ticket-id",
      { body: "ملاحظة داخلية للفريق فقط.", internal: true }
    );

    expect(mailer.sendSupportReplyEmail).not.toHaveBeenCalled();
    expect(result.emailDelivery).toEqual({ status: "not_required" });
  });
});
