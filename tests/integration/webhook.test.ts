import { describe, expect, it, vi } from "vitest";
import { handleEvolutionWebhookEvent } from "../../src/lib/evolution.js";

describe("webhook integration", () => {
  it("rejects invalid secrets and applies valid events idempotently in the repository", () => {
    const seen = new Set<string>();
    const repository = {
      applyWebhook: vi.fn((event) => {
        if (seen.has(event.id)) return { ok: true, duplicated: true };
        seen.add(event.id);
        return { ok: true, duplicated: false, status: event.status };
      })
    };

    expect(handleEvolutionWebhookEvent({ event: { id: "e1" }, secret: "bad", expectedSecret: "good", repository }).status).toBe(401);
    expect(handleEvolutionWebhookEvent({ event: { id: "e1", status: "delivered" }, secret: "good", expectedSecret: "good", repository })).toMatchObject({ ok: true, duplicated: false });
    expect(handleEvolutionWebhookEvent({ event: { id: "e1", status: "delivered" }, secret: "good", expectedSecret: "good", repository })).toMatchObject({ ok: true, duplicated: true });
  });
});
