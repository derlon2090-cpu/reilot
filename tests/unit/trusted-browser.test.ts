import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.hoisted(() => vi.fn());
vi.mock("../../src/server/db.js", () => ({ query }));
import { issueBrowserToken, trustBrowserForUser, validateTrustedBrowser } from "../../src/server/trusted-browser.js";

describe("trusted browser", () => {
  beforeEach(() => {
    process.env.TRUSTED_BROWSER_ENABLED = "true";
    process.env.TRUSTED_BROWSER_HOURS = "48";
    process.env.TRUSTED_BROWSER_PEPPER = "trusted-browser-test-secret-long-enough";
    query.mockReset();
  });

  it("creates 32 bytes of entropy and stores only a user-scoped HMAC digest", async () => {
    const token = issueBrowserToken();
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    query.mockResolvedValue({ rows: [{ expiresAt: new Date(Date.now() + 172_800_000) }], rowCount: 1 });
    await trustBrowserForUser({ userId: "user-a", tenantId: "tenant-a", rawToken: token, userAgent: "Chrome Windows" });
    const [, values] = query.mock.calls[0];
    expect(values[2]).not.toBe(token);
    expect(values[6]).toBe(172800);
    expect(String(query.mock.calls[0][0])).toContain("ON CONFLICT (user_id, token_digest)");
  });

  it("binds validation to the user so another account cannot reuse the same cookie", async () => {
    const token = issueBrowserToken();
    query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const result = await validateTrustedBrowser({ userId: "different-user", rawToken: token });
    expect(result).toEqual({ trusted: false, reason: "not_registered_for_user" });
    expect(query.mock.calls[0][1][0]).toBe("different-user");
  });

  it("revokes rather than accepts browser trust when risk is high", async () => {
    const token = issueBrowserToken();
    query.mockResolvedValue({ rows: [], rowCount: 1 });
    const result = await validateTrustedBrowser({ userId: "user-a", rawToken: token, riskDetected: true });
    expect(result).toEqual({ trusted: false, reason: "risk_detected" });
    expect(String(query.mock.calls[0][0])).toContain("revoke_reason = 'risk_detected'");
  });
});
