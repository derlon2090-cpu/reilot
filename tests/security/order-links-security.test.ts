import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("order information link security", () => {
  it("keeps dashboard operations session and tenant scoped", () => {
    const files = [
      "app/api/order-link/profile/route.js",
      "app/api/order-link/templates/route.js",
      "app/api/order-link/templates/[id]/route.js",
      "app/api/order-link/subscriptions/route.js",
      "app/api/order-link/create/route.js",
      "app/api/order-link/list/route.js",
      "app/api/order-link/[id]/send/route.js",
      "app/api/order-link/[id]/disable/route.js",
      "app/api/order-link/[id]/archive/route.js",
      "app/api/order-link/[id]/route.js"
    ];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source).toContain("requireSession");
      expect(source).toContain("auth.session.tenantId");
    }
  });

  it("requires a token and compares only its SHA-256 fingerprint publicly", () => {
    const publicRoute = readFileSync("app/api/public/order-link/[storeSlug]/[orderNumber]/route.js", "utf8");
    const server = readFileSync("src/server/order-links.js", "utf8");

    expect(publicRoute).toContain("sha256(token)");
    expect(publicRoute).toContain("l.public_token = $3");
    expect(publicRoute).toContain("Cache-Control");
    expect(server).toContain("const storedToken = sha256(publicToken)");
    expect(server).not.toContain("renewpilot-order-link");
  });

  it("does not expose server secrets in the client bundle", () => {
    const client = readFileSync("src/app/app.js", "utf8");

    expect(client).not.toContain("process.env.EVOLUTION_API_KEY");
    expect(client).not.toContain("process.env.RESEND_API_KEY");
    expect(client).not.toContain("NEXT_PUBLIC_EVOLUTION_API_KEY");
    expect(client).not.toContain("public_token");
  });

  it("applies Safe Mode before sending a public order link through WhatsApp", () => {
    const sendRoute = readFileSync("app/api/order-link/[id]/send/route.js", "utf8");

    expect(sendRoute).toContain("canSendSafely");
    expect(sendRoute).toContain("unsubscribe_list");
    expect(sendRoute).toContain("duplicate_message_window_hours");
    expect(sendRoute).toContain("recordOperationalIssue");
    expect(sendRoute).toContain("daily_sent = daily_sent + 1");
  });
});
