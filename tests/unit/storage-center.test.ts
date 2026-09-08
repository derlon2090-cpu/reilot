import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { decryptStorageValue, encryptStorageValue, normalizeStorageTimerDisplayMode, normalizeStorageTimerEndsAt, sanitizeStorageHtml, storagePayloadSize } from "../../src/server/storage-center.js";

const previousKey = process.env.STORAGE_ENCRYPTION_KEY;

afterEach(() => {
  if (previousKey === undefined) delete process.env.STORAGE_ENCRYPTION_KEY;
  else process.env.STORAGE_ENCRYPTION_KEY = previousKey;
});

describe("storage center security helpers", () => {
  it("round-trips vault values through authenticated encryption", () => {
    process.env.STORAGE_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    const envelope = encryptStorageValue("سري-123");
    expect(envelope).toMatchObject({ v: 1, alg: "A256GCM" });
    expect(JSON.stringify(envelope)).not.toContain("سري-123");
    expect(decryptStorageValue(envelope)).toBe("سري-123");
  });

  it("rejects tampered encrypted values", () => {
    process.env.STORAGE_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
    const envelope = encryptStorageValue("vault-value");
    const tampered = `${envelope.data[0] === "A" ? "B" : "A"}${envelope.data.slice(1)}`;
    expect(() => decryptStorageValue({ ...envelope, data: tampered })).toThrow("تعذر فك تشفير");
  });

  it("counts UTF-8 bytes instead of JavaScript characters", () => {
    expect(storagePayloadSize({ value: "مرحبا" })).toBe(Buffer.byteLength(JSON.stringify({ value: "مرحبا" }), "utf8"));
  });

  it("normalizes persistent document timers and rejects invalid or excessive durations", () => {
    const valid = new Date(Date.now() + 60_000).toISOString();
    expect(normalizeStorageTimerEndsAt(valid)).toBe(valid);
    expect(normalizeStorageTimerEndsAt("")).toBeNull();
    expect(() => normalizeStorageTimerEndsAt("not-a-date")).toThrow("مدة مؤقت المستند غير صالحة");
    expect(() => normalizeStorageTimerEndsAt(new Date(Date.now() + 367 * 86400000).toISOString())).toThrow("لا تتجاوز سنة واحدة");
    const source = fs.readFileSync(path.join(process.cwd(), "src/server/storage-center.js"), "utf8");
    expect(source).toContain("storage_documents.content->>'timerEndsAt'");
    expect(source).toContain("timerEndsAt: input.timerEndsAt === undefined ? row.content?.timerEndsAt : input.timerEndsAt");
  });

  it("normalizes and persists the selected long-duration timer display", () => {
    expect(normalizeStorageTimerDisplayMode("hours")).toBe("hours");
    expect(normalizeStorageTimerDisplayMode("days")).toBe("days");
    expect(normalizeStorageTimerDisplayMode("unexpected")).toBe("days");
    const source = fs.readFileSync(path.join(process.cwd(), "src/server/storage-center.js"), "utf8");
    expect(source).toContain("storage_documents.content->>'timerDisplayMode'");
    expect(source).toContain("timerDisplayMode: input.timerDisplayMode === undefined ? row.content?.timerDisplayMode : input.timerDisplayMode");
  });

  it("removes executable rich-text content", () => {
    const clean = sanitizeStorageHtml('<p onclick="steal()">آمن</p><script>alert(1)</script><a href="javascript:alert(2)">رابط</a>');
    expect(clean).not.toMatch(/script|onclick|javascript/i);
    expect(clean).toContain("آمن");
  });

  it("builds storage management insights without deleting active files", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/server/storage-center.js"), "utf8");
    expect(source).toContain("management: {");
    expect(source).toContain("largest: largestItems.rows");
    expect(source).toContain("unusedImages");
    expect(source).toContain("duplicateFiles");
    expect(source).toContain("asset.created_at<now()-interval '180 days'");
    expect(source).toContain("HAVING count(*)>1");
  });

  it("retains deleted storage items for 15 days before permanent cleanup", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/server/storage-center.js"), "utf8");
    const cron = fs.readFileSync(path.join(process.cwd(), "src/server/cron-runner.js"), "utf8");
    expect(source).toContain("STORAGE_TRASH_RETENTION_DAYS = 15");
    expect(source).toContain("purgeExpiredStorageTrash");
    expect(source).toContain("deleted_at<=now()-interval '15 days'");
    expect(cron).toContain("await purgeExpiredStorageTrash()");
  });
});
