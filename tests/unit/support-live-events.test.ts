import fs from "node:fs";
import { describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../../src/server/db.js", () => database);

import {
  adminSupportVersion,
  createSupportEventStream,
  userSupportVersion
} from "../../src/server/support-live.js";

const userRoute = fs.readFileSync("app/api/support/events/route.js", "utf8");
const adminRoute = fs.readFileSync("app/api/admin/support/events/route.js", "utf8");
const userClient = fs.readFileSync("src/app/app.js", "utf8");
const adminClient = fs.readFileSync("src/components/admin/AdminSections.jsx", "utf8");

describe("live support events", () => {
  it("scopes user versions to the signed-in tenant and owner", async () => {
    database.query.mockResolvedValueOnce({ rows: [{ version: "user-v1" }] });
    await expect(userSupportVersion({ tenantId: "tenant-1", userId: "user-1" })).resolves.toBe("user-v1");
    expect(database.query.mock.calls[0][0]).toContain("owned.created_by_user_id=$2");
    expect(database.query.mock.calls[0][1]).toEqual(["tenant-1", "user-1"]);

    database.query.mockResolvedValueOnce({ rows: [{ version: "admin-v1" }] });
    await expect(adminSupportVersion()).resolves.toBe("admin-v1");
  });

  it("streams an initial state and then only an actual support change", async () => {
    const abort = new AbortController();
    let calls = 0;
    const response = createSupportEventStream(
      new Request("http://localhost/api/support/events", { signal: abort.signal }),
      async () => ++calls === 1 ? "v1" : "v2",
      { pollMs: 250, heartbeatMs: 5_000 }
    );
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(response.headers.get("cache-control")).toContain("no-transform");

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let output = "";
    while (!output.includes("event: support-change")) {
      const chunk = await reader.read();
      if (chunk.done) break;
      output += decoder.decode(chunk.value);
    }
    abort.abort();
    expect(output).toContain("event: support-ready");
    expect(output).toContain('"version":"v2"');
  });

  it("protects both streams and connects both support interfaces with fallback", () => {
    expect(userRoute).toContain("requireSession(request)");
    expect(adminRoute).toContain('requireAdminPermission(request, "support", "read")');
    expect(userClient).toContain('new EventSource("/api/support/events")');
    expect(adminClient).toContain('new EventSource("/api/admin/support/events")');
    expect(userClient).toContain("startSupportLiveFallback");
    expect(adminClient).toContain("startFallback");
    expect(userClient).not.toContain("}, 25_000);");
  });
});
