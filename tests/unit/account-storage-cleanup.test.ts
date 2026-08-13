import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
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

  it("limits cleanup to old disposable categories instead of active business data", () => {
    expect(STORAGE_CLEANUP_CATEGORIES.map((item) => item.key)).toEqual([
      "delivery_history",
      "activity_history",
      "link_history"
    ]);
    const sourceTables = STORAGE_CLEANUP_CATEGORIES.flatMap((item) => item.sources.map((source) => source.table));
    expect(sourceTables).not.toContain("customers");
    expect(sourceTables).not.toContain("subscriptions");
    expect(sourceTables).not.toContain("order_info_links");
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
  });
});
