import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  getStorageCleanupPreview,
  selectStorageCleanupRows,
  STORAGE_CLEANUP_CATEGORIES
} from "../../src/server/storage-cleanup.js";

const root = process.cwd();
const appSource = fs.readFileSync(path.join(root, "src/app/app.js"), "utf8");
const routeSource = fs.readFileSync(path.join(root, "app/api/settings/storage/cleanup/route.js"), "utf8");

describe("account storage cleanup", () => {
  it("selects the oldest cleanup rows until the requested space is reached", () => {
    const result = selectStorageCleanupRows([
      { id: "new", createdAt: "2026-05-01", storageBytes: 500 },
      { id: "old", createdAt: "2026-01-01", storageBytes: 300 },
      { id: "middle", createdAt: "2026-03-01", storageBytes: 400 }
    ], 650);
    expect(result.selected.map((item) => item.id)).toEqual(["old", "middle"]);
    expect(result.estimatedBytes).toBe(700);
  });

  it("reconciles the cleanup list with the same total breakdown shown in settings", async () => {
    const actualBytes = {
      order_link_profiles: 1810000,
      oauth_states: 90000,
      message_queue: 50000,
      whatsapp_channels: 10000
    };
    const runner = {
      query: async (sql: string) => {
        if (sql.includes("information_schema.columns")) {
          return { rows: Object.keys(actualBytes).map((tableName) => ({ tableName })) };
        }
        if (sql.includes('AS "limitMb"')) return { rows: [{ limitMb: 1 }] };
        if (sql.includes("count(*)::int")) {
          if (sql.includes("FROM order_link_profiles")) return { rows: [{ count: 1, bytes: 1780000 }] };
          if (sql.includes("FROM message_queue")) return { rows: [{ count: 2, bytes: 50000 }] };
          return { rows: [{ count: 0, bytes: 0 }] };
        }
        const table = Object.keys(actualBytes).find((name) => sql.includes(`FROM ${name} AS record`));
        return { rows: [{ bytes: table ? actualBytes[table as keyof typeof actualBytes] : 0 }] };
      }
    };

    const preview = await getStorageCleanupPreview("tenant-1", runner);
    expect(preview.totalBytes).toBe(1960000);
    expect(preview.categories.map((item) => item.label)).toEqual([
      "روابط وقوالب الطلبات",
      "بيانات النظام",
      "الرسائل والسجلات",
      "الأجهزة"
    ]);
    expect(preview.categories[0]).toMatchObject({ bytes: 1810000, cleanableBytes: 1780000 });
    expect(preview.categories[1]).toMatchObject({ bytes: 90000, cleanableBytes: 0 });
    expect(preview.cleanableBytes).toBe(1830000);
  });

  it("limits cleanup to explicit disposable content instead of active business data", () => {
    expect(STORAGE_CLEANUP_CATEGORIES.map((item) => item.key)).toEqual([
      "order_content",
      "message_history"
    ]);
    const sourceTables = STORAGE_CLEANUP_CATEGORIES.flatMap((item) => item.sources.map((source) => source.table));
    expect(sourceTables).not.toContain("customers");
    expect(sourceTables).not.toContain("subscriptions");
    const orderCategory = STORAGE_CLEANUP_CATEGORIES.find((item) => item.key === "order_content");
    expect(orderCategory?.sources.find((source) => source.table === "order_link_profiles")?.operation).toBe("clear_order_link_logo");
    expect(orderCategory?.sources.find((source) => source.table === "order_info_links")?.where).toContain("expired");
    expect(orderCategory?.sources.find((source) => source.table === "order_info_links")?.where).not.toContain("active");
  });

  it("shows the cleanup control in user settings with explicit warning and confirmation", () => {
    expect(appSource).toContain('data-action="open-account-storage-cleanup"');
    expect(appSource).toContain("المساحة التي تريد إخلاءها");
    expect(appSource).toContain("قد يتم حذف بعض بياناتك المهمة");
    expect(appSource).toContain("مساحة محادثاتك");
    expect(routeSource).toContain('const CHAT_CATEGORY = "ai_user_chats"');
    expect(routeSource).toContain("cleanupAIChatStorage");
    expect(appSource).toContain('confirmation: "DELETE_OLD_ACCOUNT_DATA"');
    expect(routeSource).toContain('input.confirmation !== "DELETE_OLD_ACCOUNT_DATA"');
    expect(routeSource).toContain('["owner", "admin"]');
  });

  it("ranks cleanable storage and reveals only the first three causes initially", () => {
    expect(appSource).toContain('.filter((item) => Number(item?.bytes || 0) > 0)');
    expect(appSource).toContain('Number(second.bytes || 0) - Number(first.bytes || 0)');
    expect(appSource).toContain('const isInitiallyVisible = index < 3');
    expect(appSource).toContain('data-action="toggle-account-storage-categories"');
    expect(appSource).toContain('data-storage-cleanup-extra hidden');
    expect(appSource).toContain("إجمالي الاستخدام");
    expect(appSource).toContain("بيانات أساسية محمية");
    expect(routeSource).toContain("totalBytes: account.totalBytes");
    expect(routeSource).toContain("item.cleanableBytes > 0");
  });
});
