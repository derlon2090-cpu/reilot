import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("Evolution inbound interactive menu", () => {
  const client = readFileSync("src/server/evolution-client.js", "utf8");
  const webhook = readFileSync("app/api/webhooks/evolution/route.js", "utf8");
  const check = readFileSync("app/api/whatsapp/instances/[id]/check/route.js", "utf8");

  it("registers the received-message webhook for new and existing instances", () => {
    expect(client).toContain('"MESSAGES_UPSERT"');
    expect(client).toContain("/webhook/set/");
    expect(check).toContain("evolutionSetWebhook(channel.instanceName)");
  });

  it("sends the tenant menu for each deduplicated inbound direct message", () => {
    expect(webhook).toContain("data?.key?.fromMe === true");
    expect(webhook).toContain("webhook_events");
    expect(webhook).toContain("TEMPLATE_KEYS.WHATSAPP_MENU");
    expect(webhook).toContain("evolutionSendList(instanceName, phone");
    expect(webhook).toContain("ON CONFLICT (provider, external_event_id)");
  });

  it("uses Evolution's documented interactive list payload", () => {
    expect(client).toContain("/message/sendList/");
    for (const field of ["number", "title", "description", "buttonText", "footerText", "values"]) {
      expect(client).toContain(field);
    }
  });
});
