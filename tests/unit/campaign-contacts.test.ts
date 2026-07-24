import { describe, expect, it } from "vitest";
import {
  campaignDeliveryRate,
  destinationHash,
  maskDestination,
  normalizeContactEmail,
  normalizeContactPhone
} from "../../src/server/campaign-contacts.js";

describe("campaign contact normalization", () => {
  it("normalizes email without accepting malformed values", () => {
    expect(normalizeContactEmail("  NAME@Example.COM ")).toBe("name@example.com");
    expect(normalizeContactEmail("not-an-email")).toBeNull();
  });

  it("normalizes Saudi local numbers to E.164", () => {
    expect(normalizeContactPhone("050 123 4567")).toBe("+966501234567");
    expect(normalizeContactPhone("123")).toBeNull();
  });

  it("masks destinations while keeping a stable non-plain hash", () => {
    expect(maskDestination("name@example.com", "email")).toBe("na***@example.com");
    expect(maskDestination("+966501234567", "whatsapp")).toBe("+966••••567");
    expect(destinationHash("+966501234567")).not.toContain("+966501234567");
    expect(destinationHash("+966501234567")).toHaveLength(64);
  });

  it("reports zero delivery instead of inventing a result", () => {
    expect(campaignDeliveryRate({ sentCount: 0, deliveredCount: 0 })).toBe(0);
    expect(campaignDeliveryRate({ sentCount: 8, deliveredCount: 6 })).toBe(75);
  });
});
