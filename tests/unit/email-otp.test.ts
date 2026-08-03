import { beforeAll, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

beforeAll(() => {
  process.env.EMAIL_OTP_PEPPER = "test-email-otp-pepper-that-is-long-enough";
});

describe("email OTP security helpers", () => {
  it("normalizes Arabic and Eastern Arabic digits", async () => {
    const { normalizeOtpDigits } = await import("../../src/server/email-otp.js");
    expect(normalizeOtpDigits("\u0661\u06F2 \u0663\u06F4-\u0665\u06F6")).toBe("123456");
    expect(normalizeOtpDigits("123456")).toBe("123456");
    expect(normalizeOtpDigits("\u0661" + "2" + "\u06F3" + "4" + "\u0665" + "6")).toBe("123456");
  });

  it("generates exactly six digits", async () => {
    const { generateEmailOtp } = await import("../../src/server/email-otp.js");
    for (let index = 0; index < 20; index += 1) expect(generateEmailOtp()).toMatch(/^\d{6}$/);
  });

  it("binds the digest to the challenge id", async () => {
    const { digestOtp } = await import("../../src/server/email-otp.js");
    expect(digestOtp("123456", "challenge-a")).not.toBe(digestOtp("123456", "challenge-b"));
  });

  it("accepts the same OTP in English, Arabic, Persian, or mixed digits", async () => {
    const { digestOtp } = await import("../../src/server/email-otp.js");
    const challengeId = "challenge-localized-digits";
    const expected = digestOtp("123456", challengeId);
    expect(digestOtp("١٢٣٤٥٦", challengeId)).toBe(expected);
    expect(digestOtp("۱۲۳۴۵۶", challengeId)).toBe(expected);
    expect(digestOtp("١2۳4٥6", challengeId)).toBe(expected);
  });

  it("locks only the OTP challenge when joining optional tenant membership", async () => {
    const source = await readFile(new URL("../../src/server/email-otp.js", import.meta.url), "utf8");
    expect(source).toContain("FOR UPDATE OF c");
    expect(source).not.toMatch(/LEFT JOIN tenant_members[\s\S]*?WHERE c\.id = \$1 FOR UPDATE`/);
  });

  it("trusts a remembered device for exactly fifteen days", async () => {
    const { TRUSTED_DEVICE_AGE_SECONDS, trustedDeviceCookie } = await import("../../src/server/email-otp.js");
    const source = await readFile(new URL("../../src/server/email-otp.js", import.meta.url), "utf8");
    const appSource = await readFile(new URL("../../src/app/app.js", import.meta.url), "utf8");
    expect(TRUSTED_DEVICE_AGE_SECONDS).toBe(15 * 24 * 60 * 60);
    expect(trustedDeviceCookie("trusted-token")).toContain(`Max-Age=${15 * 24 * 60 * 60}`);
    expect(source).toContain("now() + interval '15 days'");
    expect(source).not.toContain("now() + interval '30 days'");
    expect(appSource).toContain("تذكّر هذا الجهاز لمدة 15 يومًا");
    expect(appSource).not.toContain("تذكّر هذا الجهاز لمدة 30 يومًا");
  });
});
