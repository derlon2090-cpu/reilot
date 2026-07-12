import { describe, expect, it } from "vitest";
import { withoutExpiredQr } from "../../src/server/whatsapp-repository.js";

describe("WhatsApp channel QR lifetime", () => {
  const now = Date.parse("2026-07-12T12:00:00.000Z");

  it("returns a QR generated less than 60 seconds ago", () => {
    const channel = { qrBase64: "data:image/png;base64,valid", lastQrGeneratedAt: "2026-07-12T11:59:30.000Z" };
    expect(withoutExpiredQr(channel, now)).toEqual(channel);
  });

  it("removes an expired QR before returning it to the browser", () => {
    const channel = { qrBase64: "data:image/png;base64,expired", lastQrGeneratedAt: "2026-07-12T11:58:00.000Z" };
    expect(withoutExpiredQr(channel, now)).toEqual({ ...channel, qrBase64: null });
  });
});
