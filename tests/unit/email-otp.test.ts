import { beforeAll, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

beforeAll(() => {
  process.env.EMAIL_OTP_PEPPER = "test-email-otp-pepper-that-is-long-enough";
  process.env.TRUSTED_BROWSER_ENABLED = "true";
  process.env.TRUSTED_BROWSER_HOURS = "48";
  process.env.COOKIE_SECURE = "true";
});

describe("email OTP and trusted-browser security helpers", () => {
  it("normalizes Arabic and Eastern Arabic digits", async () => {
    const { normalizeOtpDigits } = await import("../../src/server/email-otp-v2.js");
    expect(normalizeOtpDigits("١۲ ٣۴-٥۶")).toBe("123456");
    expect(normalizeOtpDigits("123456")).toBe("123456");
  });

  it("generates exactly six digits and binds the digest to the challenge", async () => {
    const { generateEmailOtp, digestOtp } = await import("../../src/server/email-otp-v2.js");
    for (let index = 0; index < 20; index += 1) expect(generateEmailOtp()).toMatch(/^\d{6}$/);
    expect(digestOtp("123456", "challenge-a")).not.toBe(digestOtp("123456", "challenge-b"));
  });

  it("uses a fixed 48-hour secure __Host browser cookie", async () => {
    const { TRUSTED_DEVICE_AGE_SECONDS, trustedDeviceCookie } = await import("../../src/server/email-otp-v2.js");
    const cookie = trustedDeviceCookie("A".repeat(43));
    expect(TRUSTED_DEVICE_AGE_SECONDS).toBe(48 * 60 * 60);
    expect(cookie).toContain("__Host-rvx_trusted_browser=");
    expect(cookie).toContain(`Max-Age=${48 * 60 * 60}`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).not.toContain("Domain=");
  });

  it("locks only the challenge row and never stores a raw OTP or raw browser token", async () => {
    const otpSource = await readFile(new URL("../../src/server/email-otp-v2.js", import.meta.url), "utf8");
    const browserSource = await readFile(new URL("../../src/server/trusted-browser.js", import.meta.url), "utf8");
    expect(otpSource).toContain("FOR UPDATE OF c");
    expect(otpSource).toContain("code_digest");
    expect(browserSource).toContain("token_digest");
    expect(browserSource).toContain("createHmac");
    expect(browserSource).toContain("randomBytes(32)");
  });
});
