import fs from "node:fs";
import { describe, expect, it } from "vitest";

const routeSource = fs.readFileSync("app/api/support/tickets/[ticketId]/close/route.js", "utf8");
const serviceSource = fs.readFileSync("src/server/support-tickets.js", "utf8");

describe("user support ticket close route", () => {
  it("requires the signed-in owner and same-origin protection", () => {
    expect(routeSource).toContain("requireSession(request)");
    expect(routeSource).toContain("sameOriginRequest(request)");
    expect(routeSource).toContain("closeUserTicket(auth.session, ticketId)");
  });

  it("closes only an owned ticket and records a user status history entry", () => {
    expect(serviceSource).toContain("created_by_user_id=$3 FOR UPDATE");
    expect(serviceSource).toContain("status='CLOSED'");
    expect(serviceSource).toContain("'user_closed'");
  });
});
