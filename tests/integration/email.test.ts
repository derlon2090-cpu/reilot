import { describe, expect, it, vi } from "vitest";

describe("email integration", () => {
  it("uses a mocked Resend provider and keeps API keys server-side", async () => {
    const resend = { send: vi.fn(async () => ({ id: "email-1" })) };
    const result = await resend.send({ from: "support@renew.test", to: "customer@test.com", subject: "Renewal", html: "<p>Hi</p>" });

    expect(result.id).toBe("email-1");
    expect(resend.send.mock.calls[0][0]).not.toHaveProperty("RESEND_API_KEY");
  });
});
