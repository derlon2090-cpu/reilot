import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { enqueueMessage } from "../../src/server/message-queue.js";

const appSource = readFileSync(new URL("../../src/app/app.js", import.meta.url), "utf8");
const stylesSource = readFileSync(new URL("../../src/styles/globals.css", import.meta.url), "utf8");
const settingsRouteSource = readFileSync(new URL("../../app/api/settings/route.js", import.meta.url), "utf8");
const usageRouteSource = readFileSync(new URL("../../app/api/billing/message-usage/route.js", import.meta.url), "utf8");
const planRouteSource = readFileSync(new URL("../../app/api/billing/current-plan/route.js", import.meta.url), "utf8");
const historyRouteSource = readFileSync(new URL("../../app/api/billing/usage-history/route.js", import.meta.url), "utf8");

describe("notification dropdown layout", () => {
  it("restores the dropdown to the centered dashboard position without clipping", () => {
    expect(stylesSource).toMatch(/\.notification-trigger-wrap\s*\{[\s\S]*?position:\s*relative;/);
    expect(stylesSource).toMatch(/\.notification-dropdown\s*\{[\s\S]*?position:\s*fixed;/);
    expect(stylesSource).toMatch(/\.notification-dropdown\s*\{[\s\S]*?left:\s*50%;/);
    expect(stylesSource).toMatch(/\.notification-dropdown\s*\{[\s\S]*?width:\s*min\(390px,/);
    expect(stylesSource).toMatch(/\.notification-dropdown\s*\{[\s\S]*?transform:\s*translateX\(-50%\);/);
  });
});

describe("supported outbound channels", () => {
  it("does not expose SMS in template channel selectors or marketing copy", () => {
    expect(appSource).not.toContain('value="sms"');
    expect(appSource).not.toContain("واتساب وSMS");
    expect(settingsRouteSource).toContain("- 'sms'");
    expect(settingsRouteSource).not.toContain("JSON.stringify(body.notificationChannels || {})");
    expect(usageRouteSource).toContain("channels, byChannel");
    expect(planRouteSource).not.toContain('"smsMessageLimit"');
    expect(historyRouteSource).not.toContain('"smsLimit"');
  });

  it("rejects a new SMS queue request before any database work", async () => {
    await expect(enqueueMessage({
      tenantId: "00000000-0000-0000-0000-000000000001",
      channelType: "sms",
      messageBody: "test"
    })).resolves.toEqual({ ok: false, reason: "invalid_queue_request" });
  });
});
