import { describe, expect, it } from "vitest";
import {
  campaignAudienceFilter,
  campaignCreateSchema,
  renderCampaignMessage,
  validateCampaignMessage
} from "../../src/server/campaign-config.js";

const deviceId = "00000000-0000-4000-8000-000000000001";
const future = () => new Date(Date.now() + 10 * 60_000).toISOString();
const valid = (patch: Record<string, unknown> = {}) => ({
  name: "حملة العملاء",
  channel: "whatsapp",
  whatsappChannelId: deviceId,
  body: "مرحبًا {{customer_name}}",
  isEnabled: true,
  scheduledFor: future(),
  endTime: "23:00",
  allowedDays: [0, 1, 2, 3, 4, 5, 6],
  minDelaySeconds: 20,
  maxDelaySeconds: 120,
  ...patch
});

describe("campaign creation controls", () => {
  it("accepts a complete WhatsApp campaign", () => expect(campaignCreateSchema.safeParse(valid()).success).toBe(true));
  it("rejects a one-character campaign name", () => expect(campaignCreateSchema.safeParse(valid({ name: "س" })).success).toBe(false));
  it("requires a selected WhatsApp device", () => expect(campaignCreateSchema.safeParse(valid({ whatsappChannelId: null })).success).toBe(false));
  it("requires an email subject", () => expect(campaignCreateSchema.safeParse(valid({ channel: "email", whatsappChannelId: null, subject: null })).success).toBe(false));
  it("accepts an email campaign with a subject", () => expect(campaignCreateSchema.safeParse(valid({ channel: "email", whatsappChannelId: null, subject: "عرض خاص" })).success).toBe(true));
  it("accepts a supported email design", () => expect(campaignCreateSchema.safeParse(valid({ channel: "email", whatsappChannelId: null, subject: "عرض خاص", audienceFilter: { emailDesign: "luxury" } })).success).toBe(true));
  it("rejects an unknown email design", () => expect(campaignCreateSchema.safeParse(valid({ channel: "email", whatsappChannelId: null, subject: "عرض خاص", audienceFilter: { emailDesign: "copied-layout" } })).success).toBe(false));
  it("rejects an active campaign scheduled in the past", () => expect(campaignCreateSchema.safeParse(valid({ scheduledFor: new Date(Date.now() - 60_000).toISOString() })).success).toBe(false));
  it("allows a disabled draft to retain a past start value", () => expect(campaignCreateSchema.safeParse(valid({ isEnabled: false, scheduledFor: new Date(Date.now() - 60_000).toISOString() })).success).toBe(true));
  it("rejects a minimum delay below twenty seconds", () => expect(campaignCreateSchema.safeParse(valid({ minDelaySeconds: 19 })).success).toBe(false));
  it("rejects a maximum delay below the minimum", () => expect(campaignCreateSchema.safeParse(valid({ minDelaySeconds: 60, maxDelaySeconds: 40 })).success).toBe(false));
  it("rejects a schedule without selected days", () => expect(campaignCreateSchema.safeParse(valid({ allowedDays: [] })).success).toBe(false));
  it("normalizes and sorts duplicate weekdays", () => expect(campaignCreateSchema.parse(valid({ allowedDays: [6, 1, 1, 0] })).allowedDays).toEqual([0, 1, 6]));
  it("rejects malformed campaign end time", () => expect(campaignCreateSchema.safeParse(valid({ endTime: "25:90" })).success).toBe(false));
  it("accepts a studio campaign with a valid custom card", () => expect(campaignCreateSchema.safeParse(valid({ audienceFilter: { campaignKind: "custom", cards: [{ sourceType: "custom", title: "عرض", bodyText: "تفاصيل العرض", buttonText: "اعرف المزيد", buttonUrl: "https://renvix.app/offers" }] } })).success).toBe(true));
  it("rejects store cards without a real product id", () => expect(campaignCreateSchema.safeParse(valid({ audienceFilter: { campaignKind: "product", cards: [{ sourceType: "store_product", bodyText: "تفاصيل المنتج", buttonText: "عرض المنتج", buttonUrl: "https://renvix.app/products/1" }] } })).success).toBe(false));
  it("accepts plain text without variables", () => expect(validateCampaignMessage("عرض خاص لعملائنا")).toBeNull());
  it("accepts a simple contact variable", () => expect(validateCampaignMessage("مرحبًا {{customer_name}}")).toBeNull());
  it("accepts a three-choice spin group", () => expect(validateCampaignMessage("{{ مرحبا | اهلا بك | حياك }}")).toBeNull());
  it("rejects unclosed variable braces", () => expect(validateCampaignMessage("مرحبًا {{customer_name}")).toContain("إغلاق"));
  it("rejects an empty variable", () => expect(validateCampaignMessage("مرحبًا {{ }}")).toContain("فارغ"));
  it("rejects a spin group with only one valid choice", () => expect(validateCampaignMessage("{{ مرحبا | }}")).toContain("خيارين"));
  it("renders contact variables and deterministic spin choices", () => expect(renderCampaignMessage("{{ مرحبا | حياك }} {{customer_name}}", { customer_name: "سارة" }, 1)).toBe("حياك سارة"));
  it("persists the chosen group and keyword sets in the audience filter", () => expect(campaignAudienceFilter({ audienceFilter: { status: "active" }, groupId: deviceId, contactKeywords: ["customer_name"], customKeywords: ["عرض"] })).toEqual({ status: "active", groupId: deviceId, contactKeywords: ["customer_name"], customKeywords: ["عرض"] }));
});
