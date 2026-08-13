import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { getAIChatStorage, selectAIStorageCleanupCandidates } from "../../src/server/ai/storage.js";

const rows = [
  { id: "00000000-0000-4000-8000-000000000001", status: "deleted", isPinned: false, lastMessageAt: "2026-01-01", storageBytes: 300 },
  { id: "00000000-0000-4000-8000-000000000002", status: "archived", isPinned: false, lastMessageAt: "2026-02-01", storageBytes: 400 },
  { id: "00000000-0000-4000-8000-000000000003", status: "active", isPinned: true, lastMessageAt: "2026-03-01", storageBytes: 900 },
  { id: "00000000-0000-4000-8000-000000000004", status: "active", isPinned: false, lastMessageAt: "2026-04-01", storageBytes: 800 }
];

describe("AI chat storage cleanup selection", () => {
  it("reports the current user's complete chat footprint without counting shared AI data", async () => {
    const runner = {
      query: async (sql: string) => sql.includes('AS "totalBytes"')
        ? { rows: [{ totalBytes: 12_345, conversationCount: 2 }] }
        : { rows: [
          { id: rows[0].id, status: "archived", isPinned: false, lastMessageAt: "2026-01-01", storageBytes: 4_000 },
          { id: rows[1].id, status: "active", isPinned: false, lastMessageAt: "2026-02-01", storageBytes: 8_345 }
        ] }
    };

    const result = await getAIChatStorage({ tenantId: "tenant-1", userId: "user-1" }, {}, runner);

    expect(result.totalBytes).toBe(12_345);
    expect(result.conversationCount).toBe(2);
    expect(result.cleanableBytes).toBe(4_000);
    expect(result.cleanableConversations).toBe(1);
  });

  it("deletes oldest unpinned conversations until the requested space is met", () => {
    const result = selectAIStorageCleanupCandidates(rows, 650, {
      keepConversationId: "00000000-0000-4000-8000-000000000004"
    });
    expect(result.selected.map((row) => row.id)).toEqual([
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002"
    ]);
    expect(result.estimatedFreedBytes).toBe(700);
  });

  it("never removes pinned chats and retains the newest chat without an explicit current chat", () => {
    const result = selectAIStorageCleanupCandidates(rows, 10_000);
    expect(result.selected.some((row) => row.isPinned)).toBe(false);
    expect(result.selected.some((row) => row.id === "00000000-0000-4000-8000-000000000004")).toBe(false);
    expect(result.retainedConversationId).toBe("00000000-0000-4000-8000-000000000004");
  });

  it("counts durable attachment bytes in both chat and tenant plan storage", async () => {
    const [chatStorage, tenantStorage, migration] = await Promise.all([
      readFile("src/server/ai/storage.js", "utf8"),
      readFile("src/server/tenant-storage.js", "utf8"),
      readFile("drizzle/0087_ai_attachment_storage_reconciliation.sql", "utf8")
    ]);
    expect(chatStorage).toContain("SELECT sum(a.size_bytes) FROM ai_attachments a");
    expect(tenantStorage).toContain('table === "ai_attachments"');
    expect(tenantStorage).toContain("pg_column_size(record) + record.size_bytes");
    expect(migration).toContain("TG_TABLE_NAME = 'ai_attachments'");
    expect(migration).toContain("each private R2 object size exactly once");
  });
});
