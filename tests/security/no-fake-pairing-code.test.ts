import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("pairing code source safety", () => {
  it("only displays provider-returned codes and keeps a QR fallback", () => {
    const client = fs.readFileSync("src/app/app.js", "utf8");
    const route = fs.readFileSync("app/api/whatsapp/instances/[id]/pairing-code/route.js", "utf8");

    expect(`${client}\n${route}`).not.toMatch(/12345678|ABCD-EFGH|WP-1234/);
    expect(route).toContain("evolutionPairingCode");
    expect(client).toContain("payload.pairingCode");
    expect(client).toContain("استخدام الباركود بدلًا من ذلك");
  });
});
