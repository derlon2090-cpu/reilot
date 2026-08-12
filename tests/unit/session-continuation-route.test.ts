import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSessionWithToken: vi.fn(),
  sessionCookie: vi.fn((token: string, maxAge: number) => `renewpilot_session=${token}; Max-Age=${maxAge}; Domain=.renvix.app`)
}));

vi.mock("../../src/server/session.js", () => ({
  getSessionWithToken: mocks.getSessionWithToken,
  sessionCookie: mocks.sessionCookie
}));

vi.mock("../../src/server/app-url.js", () => ({
  appBaseUrl: () => "https://renvix.app",
  authPageUrl: (pathname: string, returnTo: string) => `https://accounts.renvix.app${pathname}?returnTo=${encodeURIComponent(returnTo)}`
}));

import { GET } from "../../app/api/auth/session/continue/route.js";

describe("session continuation route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("upgrades a host-only session cookie before redirecting to the app", async () => {
    mocks.getSessionWithToken.mockResolvedValue({
      token: "valid-token",
      session: { id: "session-1", expiresAt: new Date(Date.now() + 60_000).toISOString() }
    });

    const response = await GET(new Request("https://accounts.renvix.app/api/auth/session/continue?returnTo=%2Fdashboard"));

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://renvix.app/dashboard");
    expect(response.headers.get("set-cookie")).toContain("Domain=.renvix.app");
  });

  it("returns an invalid or missing session to the login page without an external redirect", async () => {
    mocks.getSessionWithToken.mockResolvedValue(null);

    const response = await GET(new Request("https://accounts.renvix.app/api/auth/session/continue?returnTo=https://evil.example"));

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://accounts.renvix.app/login?returnTo=%2Fdashboard");
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
