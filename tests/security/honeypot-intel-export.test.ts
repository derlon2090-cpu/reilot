import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../../src/server/db.js", () => ({ query: mocks.query }));
import { GET } from "../../app/api/internal/security/honeypot-intel/route.js";

describe("honeypot intelligence export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("HONEYPOT_INTEL_EXPORT_TOKEN", "i".repeat(40));
  });

  it("hides the endpoint without its independent bearer", async () => {
    const response = await GET(new Request("https://api.renvix.app/api/internal/security/honeypot-intel"));
    expect(response.status).toBe(404);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("exports only bounded path intelligence with an opaque cursor", async () => {
    mocks.query.mockResolvedValue({ rows: [{
      eventId: "11111111-1111-4111-8111-111111111111",
      path: "//site/wp-includes/wlwmanifest.xml",
      seenAt: "2026-10-07T10:00:00.000Z"
    }] });
    const response = await GET(new Request("https://api.renvix.app/api/internal/security/honeypot-intel", {
      headers: { authorization: `Bearer ${"i".repeat(40)}` }
    }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.events).toEqual([{
      id: "11111111-1111-4111-8111-111111111111",
      path: "//site/wp-includes/wlwmanifest.xml",
      seenAt: "2026-10-07T10:00:00.000Z"
    }]);
    expect(body.nextCursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(String(mocks.query.mock.calls[0][0])).toContain("event_type='ADMIN_HONEYPOT_ACCESS'");
  });
});
