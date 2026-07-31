import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const routeSource = fs.readFileSync(
  path.resolve(process.cwd(), "app/api/public/support/tickets/route.js"),
  "utf8"
);
const serviceSource = fs.readFileSync(
  path.resolve(process.cwd(), "src/server/support-tickets.js"),
  "utf8"
);

describe("public support ticket route", () => {
  it("is public but enforces same-origin requests and rate limiting", () => {
    expect(routeSource).toContain("sameOriginRequest(request)");
    expect(routeSource).not.toContain("requireSession");
    expect(routeSource).toContain('createHash("sha256")');
    expect(serviceSource).toContain("created_at > now() - interval '1 hour'");
    expect(serviceSource).toContain(">= 3");
  });

  it("does not persist the raw requester network address", () => {
    expect(routeSource).toContain("requestFingerprint(request)");
    expect(routeSource).toContain('.digest("hex")');
    expect(serviceSource).toContain("metadata->>'requestFingerprint'");
    expect(serviceSource).not.toContain("requestIp");
  });

  it("returns only the public ticket number", () => {
    expect(routeSource).toContain("item: { ticketNumber: item.ticketNumber }");
  });
});
