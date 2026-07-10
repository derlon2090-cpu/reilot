import { describe, expect, it } from "vitest";
import { checkRateLimit } from "../../src/lib/rateLimit.js";

describe("rate limit security", () => {
  it("limits login and send-test attempts within a window", () => {
    const now = Date.now();
    const attempts = [
      { key: "login:ip-1", createdAt: now - 1000 },
      { key: "login:ip-1", createdAt: now - 900 },
      { key: "send-test:tenant-a", createdAt: now - 1000 }
    ];

    expect(checkRateLimit({ attempts, key: "login:ip-1", limit: 2, windowMs: 60000, now }).status).toBe(429);
    expect(checkRateLimit({ attempts, key: "send-test:tenant-a", limit: 2, windowMs: 60000, now }).ok).toBe(true);
  });
});
