import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock("../../src/lib/email/resend.js", () => ({
  resolveVerifiedEmailConfig: vi.fn(async () => ({
    from: "Renvix <noreply@renvix.app>",
    supportEmail: "support@renvix.app"
  })),
  createResendClient: vi.fn(() => ({ emails: { send: mocks.send } }))
}));

import { sendEmail } from "../../src/lib/email/send-email.js";

afterEach(() => {
  mocks.send.mockReset();
  vi.useRealTimers();
});

describe("email delivery resilience", () => {
  it("retries a transient provider failure with the same idempotency key", async () => {
    vi.useFakeTimers();
    mocks.send
      .mockRejectedValueOnce(Object.assign(new Error("fetch failed"), { code: "ETIMEDOUT" }))
      .mockResolvedValueOnce({ data: { id: "email-1" }, error: null });

    const pending = sendEmail({
      to: "admin@example.com",
      subject: "Verification",
      html: "<p>OTP</p>",
      text: "OTP",
      idempotencyKey: "login-otp-stable-key"
    });
    await vi.advanceTimersByTimeAsync(250);

    await expect(pending).resolves.toEqual({ id: "email-1" });
    expect(mocks.send).toHaveBeenCalledTimes(2);
    expect(mocks.send.mock.calls[0][1]).toEqual({ idempotencyKey: "login-otp-stable-key" });
    expect(mocks.send.mock.calls[1][1]).toEqual({ idempotencyKey: "login-otp-stable-key" });
  });

  it("maps an unexpected provider exception to a stable authentication error code", async () => {
    mocks.send.mockRejectedValueOnce(new Error("provider refused request"));
    await expect(sendEmail({
      to: "admin@example.com",
      subject: "Verification",
      html: "<p>OTP</p>",
      text: "OTP"
    })).rejects.toMatchObject({ code: "EMAIL_PROVIDER_ERROR" });
  });

  it("rejects malformed recipients before contacting the provider", async () => {
    await expect(sendEmail({
      to: "not-an-email",
      subject: "Verification",
      html: "<p>OTP</p>",
      text: "OTP"
    })).rejects.toMatchObject({ code: "EMAIL_DELIVERY_UNAVAILABLE", providerCode: "invalid_recipient" });
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
