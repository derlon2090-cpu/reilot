import { beforeEach, describe, expect, it, vi } from "vitest";

const validateTrustedBrowser = vi.hoisted(() => vi.fn());
vi.mock("../../src/server/trusted-browser.js", () => ({ validateTrustedBrowser }));
import { resolveSecondFactor } from "../../src/server/second-factor-router.js";

describe("SecondFactorRouter", () => {
  beforeEach(() => {
    process.env.AUTH_SECOND_FACTOR_REQUIRED = "true";
    process.env.EMAIL_OTP_FALLBACK_ENABLED = "true";
    process.env.EMAIL_OTP_ENFORCE_ALL = "false";
    validateTrustedBrowser.mockReset().mockResolvedValue({ trusted: false, reason: "missing_cookie" });
  });

  it("prioritizes a trusted browser for the same user", async () => {
    validateTrustedBrowser.mockResolvedValue({ trusted: true, reason: "valid" });
    const factor = await resolveSecondFactor({ user: { id: "user-a", mfaEnabled: true, mfaSecret: "secret" }, rawBrowserToken: "token" });
    expect(factor).toMatchObject({ method: "trusted_browser", requiresChallenge: false });
    expect(validateTrustedBrowser).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-a", rawToken: "token" }));
  });

  it("uses TOTP only when both the enabled flag and encrypted secret exist", async () => {
    await expect(resolveSecondFactor({ user: { id: "user-a", mfaEnabled: true, mfaSecret: "secret" } })).resolves.toMatchObject({ method: "totp" });
    await expect(resolveSecondFactor({ user: { id: "user-a", mfaEnabled: true, mfaSecret: null } })).resolves.toMatchObject({ method: "email_otp" });
  });

  it("uses email OTP only for an untrusted account without active TOTP", async () => {
    const factor = await resolveSecondFactor({ user: { id: "user-a", mfaEnabled: false, mfaSecret: null } });
    expect(factor).toMatchObject({ method: "email_otp", requiresChallenge: true });
  });

  it("never lets EMAIL_OTP_ENFORCE_ALL override an enabled TOTP factor", async () => {
    process.env.EMAIL_OTP_ENFORCE_ALL = "true";
    const factor = await resolveSecondFactor({ user: { id: "user-a", mfaEnabled: true, mfaSecret: "secret" } });
    expect(factor.method).toBe("totp");
  });

  it("fails closed to a fresh factor when trusted-browser validation is unavailable", async () => {
    validateTrustedBrowser.mockRejectedValue(Object.assign(new Error("legacy trusted-device schema"), { code: "42703" }));
    const factor = await resolveSecondFactor({ user: { id: "user-a", mfaEnabled: true, mfaSecret: "secret" }, rawBrowserToken: "token" });
    expect(factor).toMatchObject({ method: "totp", reason: "validation_unavailable", requiresChallenge: true });
  });
});
