import { afterEach, describe, expect, it, vi } from "vitest";
import {
  classifyAmbiguousDeliveryContent,
  extractTrustedDeliveryContent,
  parseSmartDeliveryContent,
  restoreDeliveryTokens,
  tokenizeDeliverySecrets
} from "../../src/server/smart-delivery-content.js";
import {
  durationWindow,
  extendDurationWindow,
  parseExplicitDuration,
  resolveProductDuration,
  resolveProductDurationWithDeepSeek
} from "../../src/server/product-duration-resolver.js";

afterEach(() => {
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.DEEPSEEK_BASE_URL;
  delete process.env.DEEPSEEK_FLASH_MODEL;
  vi.restoreAllMocks();
});

describe("smart Salla delivery parser", () => {
  it("classifies labelled Arabic credentials without changing values", () => {
    const parsed = parseSmartDeliveryContent("اشتراك شاهد سنة\nالايميل customer@example.com\nالباسورد A#bc2026\nالكود RVX-2026-DEMO");
    expect(parsed.title).toBe("اشتراك شاهد سنة");
    expect(parsed.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "email", value: "customer@example.com" }),
      expect.objectContaining({ type: "password", value: "A#bc2026" }),
      expect.objectContaining({ type: "activation_code", value: "RVX-2026-DEMO" })
    ]));
  });

  it("detects an unlabeled password after an exact email", () => {
    const parsed = parseSmartDeliveryContent("بيانات الحساب\ncustomer@example.com\nPass@2026");
    expect(parsed.fields).toEqual(expect.arrayContaining([expect.objectContaining({ type: "password", value: "Pass@2026" })]));
  });

  it("protects an unlabeled high-entropy activation code", () => {
    const parsed = parseSmartDeliveryContent("منتج رقمي\nRVX-2026-DEMO");
    expect(parsed.fields).toContainEqual(expect.objectContaining({
      type: "activation_code", value: "RVX-2026-DEMO", sensitive: true
    }));
  });

  it.each([
    ["username test_user", "username", "test_user"],
    ["PIN 7722", "pin", "7722"],
    ["Serial: SN-92882", "serial", "SN-92882"],
    ["الرابط: https://example.com/login", "url", "https://example.com/login"],
    ["تاريخ الانتهاء 2027-01-10", "expires_at", "2027-01-10"],
    ["الضمان شهر", "warranty", "شهر"]
  ])("classifies %s", (raw, type, value) => {
    expect(parseSmartDeliveryContent(raw).fields).toContainEqual(expect.objectContaining({ type, value }));
  });

  it("separates important instructions", () => {
    const parsed = parseSmartDeliveryContent("منتج\nمهم لا تغير البريد نهائياً");
    expect(parsed.instructions).toEqual(["مهم لا تغير البريد نهائياً"]);
  });

  it("uses only the configured item field and ignores internal notes", () => {
    const order = {
      internal_notes: "password: must-not-leak",
      items: [{ id: 10, name: "اشتراك", custom_fields: [
        { key: "renvix_delivery_content", value: "email: safe@example.com" },
        { key: "other", value: "ignored" }
      ] }]
    };
    const values = extractTrustedDeliveryContent(order, { enabled: true, sourceType: "item_custom_field", sourceFieldKey: "renvix_delivery_content" });
    expect(values).toEqual([{ orderItemId: "10", productName: "اشتراك", content: "email: safe@example.com" }]);
    expect(JSON.stringify(values)).not.toContain("must-not-leak");
  });

  it("returns nothing when the trusted source is disabled", () => {
    expect(extractTrustedDeliveryContent({ items: [] }, { enabled: false, sourceType: "item_custom_field", sourceFieldKey: "x" })).toEqual([]);
  });

  it("supports separate delivery fields for multiple order items", () => {
    const values = extractTrustedDeliveryContent({ items: [
      { id: 1, name: "أ", options: [{ key: "delivery", value: "code A" }] },
      { id: 2, name: "ب", options: [{ key: "delivery", value: "code B" }] }
    ] }, { enabled: true, sourceType: "item_option", sourceFieldKey: "delivery" });
    expect(values.map((item) => item.orderItemId)).toEqual(["1", "2"]);
  });

  it("tokenizes every sensitive value before an external classifier", () => {
    const parsed = parseSmartDeliveryContent("منتج\nemail a@example.com\npassword S3cret\nlink https://example.com/a");
    const { redacted, tokenMap } = tokenizeDeliverySecrets(parsed);
    const serialized = JSON.stringify(redacted);
    expect(serialized).not.toContain("a@example.com");
    expect(serialized).not.toContain("S3cret");
    expect(serialized).not.toContain("https://example.com/a");
    expect(tokenMap.size).toBe(3);
  });

  it("rejects tokens invented by the classifier", () => {
    expect(() => restoreDeliveryTokens({ fields: [{ value: "[[PASSWORD_99]]" }] }, new Map())).toThrow("deepseek_invented_token");
  });

  it("does not call DeepSeek when local parsing is unambiguous", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    const fetchImpl = vi.fn();
    const parsed = parseSmartDeliveryContent("email test@example.com");
    await classifyAmbiguousDeliveryContent(parsed, { fetchImpl });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("sends only redacted values to DeepSeek and restores exact tokens", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    const parsed = parseSmartDeliveryContent("منتج\nemail test@example.com\nبيان غير مصنف");
    const fetchImpl = vi.fn(async (_url, options) => {
      const request = JSON.parse(options.body);
      expect(options.body).not.toContain("test@example.com");
      const redacted = JSON.parse(request.messages[1].content);
      return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(redacted) } }] }) };
    });
    const result = await classifyAmbiguousDeliveryContent(parsed, { fetchImpl });
    expect(result.fields).toContainEqual(expect.objectContaining({ type: "email", value: "test@example.com" }));
  });

  it("falls back locally when DeepSeek times out or fails", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    const parsed = parseSmartDeliveryContent("منتج\nبيان غير مصنف");
    const result = await classifyAmbiguousDeliveryContent(parsed, { fetchImpl: vi.fn(async () => { throw new Error("timeout"); }) });
    expect(result.classificationSource).toBe("local_fallback");
  });
});

describe("explicit product duration", () => {
  it.each([
    ["30 يوم", 30], ["شهر", 30], ["شهرين", 60], ["3 شهور", 90], ["18 شهر", 540],
    ["أسبوعين", 14], ["سنة", 365], ["سنتين", 730], ["نصف سنة", 180], ["ربع سنة", 90],
    ["٣ أشهر", 90], ["١٨ شهر", 540], ["6M", 180], ["1Y", 365], ["يومين", 2]
  ])("parses %s", (raw, expected) => expect(parseExplicitDuration(raw)?.durationDays).toBe(expected));

  it("supports lifetime explicitly", () => expect(parseExplicitDuration("مدى الحياة")).toEqual({ lifetime: true, durationDays: null }));
  it("does not confuse warranty with access duration", () => expect(parseExplicitDuration("الضمان شهر")).toBeNull());
  it("does not confuse a trial with product duration", () => expect(parseExplicitDuration("تجربة 30 يوم")).toBeNull());
  it("separates product duration from warranty", () => expect(parseExplicitDuration("اشتراك 3 أشهر، الضمان شهر")?.durationDays).toBe(90));
  it("does not confuse delivery deadline with access duration", () => expect(parseExplicitDuration("التسليم خلال يومين")).toBeNull());

  it("uses the documented source priority", () => {
    const result = resolveProductDuration({ deliveryContent: "3 شهور", itemTitleSnapshot: "سنة" });
    expect(result).toMatchObject({ durationDays: 90, source: "delivery_content" });
  });

  it("gives a manual override highest priority", () => {
    const result = resolveProductDuration({ manualOverride: { days: 45 }, deliveryContent: "سنة" });
    expect(result).toMatchObject({ durationDays: 45, source: "manual_override" });
  });

  it("starts only at the supplied completed transition and computes UTC expiry", () => {
    const window = durationWindow({ visible: true, lifetime: false, durationDays: 30 }, new Date("2026-08-03T10:00:00.000Z"));
    expect(window.startsAt.toISOString()).toBe("2026-08-03T10:00:00.000Z");
    expect(window.expiresAt?.toISOString()).toBe("2026-09-02T10:00:00.000Z");
  });

  it("extends renewal from a future expiry", () => {
    expect(extendDurationWindow("2027-01-01T00:00:00.000Z", 30).toISOString()).toBe("2027-01-31T00:00:00.000Z");
  });

  it("uses a redacted DeepSeek fallback only for an ambiguous explicit duration", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    const fetchImpl = vi.fn(async (_url, options) => {
      expect(options.body).not.toContain("customer@example.com");
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify({
        candidates: [{ value: 3, unit: "month", context: "subscription_duration", source: "product_description", matchedText: "ثلاثة أشهر" }],
        selectedServiceDurationIndex: 0
      }) } }] }) };
    });
    const result = await resolveProductDurationWithDeepSeek({
      productDescription: "اشتراك لمدة ثلاثة أشهر customer@example.com"
    }, { fetchImpl });
    expect(result).toMatchObject({ durationDays: 90, source: "product_description", classificationSource: "deepseek" });
  });
});
