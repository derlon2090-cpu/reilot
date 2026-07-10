import { describe, expect, it, vi } from "vitest";
import { handleEvolutionWebhookEvent } from "../../src/lib/evolution.js";

describe("webhook verification security", () => {
  it("rejects forged Evolution webhooks without the configured secret", () => {
    const repository = { applyWebhook: vi.fn() };

    expect(handleEvolutionWebhookEvent({
      event: { id: "event-1" },
      secret: "forged",
      expectedSecret: "real-secret",
      repository
    })).toEqual({ ok: false, status: 401 });
    expect(repository.applyWebhook).not.toHaveBeenCalled();
  });

  it("maps Evolution unsubscribe replies before applying the webhook", () => {
    const repository = { applyWebhook: vi.fn((event) => ({ ok: true, event })) };

    const response = handleEvolutionWebhookEvent({
      event: { type: "incoming_reply", text: "stop", instanceId: "evo-1" },
      secret: "real-secret",
      expectedSecret: "real-secret",
      repository
    });

    expect(response.event.type).toBe("unsubscribe");
  });

  it("accepts the expected Evolution webhook event types", () => {
    const repository = { applyWebhook: vi.fn((event) => ({ ok: true, event })) };
    const events = ["connected", "disconnected", "message_sent", "message_delivered", "message_failed", "incoming_reply"];

    for (const type of events) {
      expect(handleEvolutionWebhookEvent({
        event: { type, instanceId: "evo-1" },
        secret: "real-secret",
        expectedSecret: "real-secret",
        repository
      })).toMatchObject({ ok: true });
    }

    expect(repository.applyWebhook).toHaveBeenCalledTimes(events.length);
  });
});
