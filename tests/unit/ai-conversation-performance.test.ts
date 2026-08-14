import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn(), transaction: vi.fn(), deleteObjectsForConversation: vi.fn() }));
vi.mock("../../src/server/db.js", () => ({ query: mocks.query, transaction: mocks.transaction }));
vi.mock("../../src/server/attachments/service.js", () => ({ deleteObjectsForConversation: mocks.deleteObjectsForConversation }));

import { getAIConversation, listAIConversations } from "../../src/server/ai/conversations.js";

const session = { tenantId: "tenant-1", userId: "user-1" };

describe("AI conversation read performance", () => {
  beforeEach(() => vi.clearAllMocks());

  it("aggregates the bounded sidebar page instead of running correlated scans for 100 chats", async () => {
    mocks.query.mockResolvedValue({ rows: [] });
    await listAIConversations(session, { limit: 500 });

    const [sql, values] = mocks.query.mock.calls[0];
    expect(sql).toContain("WITH selected AS MATERIALIZED");
    expect(sql).toContain("JOIN selected s ON s.id=m.conversation_id");
    expect(sql).not.toContain("jsonb_array_elements");
    expect(values.at(-1)).toBe(60);
  });

  it("returns the latest bounded message window in chronological order", async () => {
    mocks.query
      .mockResolvedValueOnce({ rows: [{ id: "chat-1", title: "Chat" }] })
      .mockResolvedValueOnce({ rows: [{ id: "message-1" }] });

    const result = await getAIConversation(session, "chat-1", { limit: 500 });
    const [sql, values] = mocks.query.mock.calls[1];
    expect(sql).toContain("ORDER BY created_at DESC,id DESC LIMIT $4");
    expect(sql).toContain('ORDER BY "createdAt" ASC,id ASC');
    expect(values[3]).toBe(60);
    expect(result?.messages).toHaveLength(1);
  });
});
