import { describe, expect, it, vi } from "vitest";
import { handleWebhookEvent } from "../../src/lib/whatsapp.js";

describe("webhook verification security", () => {
  it("rejects forged Whapi webhooks without the configured secret", () => {
    const repository = { applyWebhook: vi.fn() };

    expect(handleWebhookEvent({
      event: { id: "event-1" },
      secret: "forged",
      expectedSecret: "real-secret",
      repository
    })).toEqual({ ok: false, status: 401 });
    expect(repository.applyWebhook).not.toHaveBeenCalled();
  });
});
