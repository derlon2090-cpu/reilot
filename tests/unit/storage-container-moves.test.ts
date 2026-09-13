import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../../src/server/db.js", () => ({ query: db.query, transaction: (work: (client: unknown) => unknown) => work(db) }));
import { createStorageFolder, moveStorageItem } from "../../src/server/storage-center.js";

const session = { tenantId: "tenant-a", userId: "user-a" };
const source = "11111111-1111-4111-8111-111111111111";
const destination = "22222222-2222-4222-8222-222222222222";

describe("storage containers", () => {
  beforeEach(() => { db.query.mockReset(); });

  it("creates a named container inside Files without an upload or document", async () => {
    db.query.mockImplementation(async (sql: string, values: unknown[]) => {
      if (sql.includes("SELECT id,name,is_system")) return { rows: [{ id: destination, isSystem: true, systemType: "files" }] };
      if (sql.includes("INSERT INTO storage_folders")) return { rows: [{ id: source, parentId: values[1], name: values[2] }] };
      return { rows: [] };
    });
    const container = await createStorageFolder(session, { name: "حسابات أبل الهند", parentId: destination });
    expect(container).toEqual({ id: source, parentId: destination, name: "حسابات أبل الهند" });
    expect(db.query.mock.calls.some(([sql]) => /INSERT INTO storage_(documents|assets)/.test(sql))).toBe(false);
  });

  it("rejects creation under another tenant's missing folder", async () => {
    db.query.mockResolvedValue({ rows: [] });
    await expect(createStorageFolder(session, { name: "ملف", parentId: destination })).rejects.toMatchObject({ code: "FOLDER_NOT_FOUND" });
    expect(db.query.mock.calls[0][1]).toEqual([destination, "tenant-a"]);
  });

  function prepareMove(systemType = "custom", cycle = false, isSystem = false) {
    db.query.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT id,name,is_system")) return { rows: [{ id: destination, systemType, isSystem: systemType !== "custom" }] };
      if (sql.includes('SELECT id,is_system AS "isSystem"')) return { rows: [{ id: source, isSystem }] };
      if (sql.includes("WITH RECURSIVE tree")) return { rows: cycle ? [{ id: destination }] : [] };
      return { rows: [] };
    });
  }

  it("moves a container with a tenant-scoped hierarchy lock and saves its parent", async () => {
    prepareMove("files");
    expect(await moveStorageItem(session, "folder", source, destination)).toEqual({ id: source, kind: "folder", folderId: destination });
    expect(db.query.mock.calls[0]).toEqual(["SELECT id FROM tenants WHERE id=$1 FOR UPDATE", ["tenant-a"]]);
    const update = db.query.mock.calls.find(([sql]) => sql.startsWith("UPDATE storage_folders"));
    expect(update?.[1]).toEqual([source, "tenant-a", destination]);
  });

  it("rejects cycles before updating the hierarchy", async () => {
    prepareMove("custom", true);
    await expect(moveStorageItem(session, "folder", source, destination)).rejects.toMatchObject({ code: "FOLDER_MOVE_CYCLE" });
    expect(db.query.mock.calls.some(([sql]) => sql.startsWith("UPDATE"))).toBe(false);
  });

  it("rejects moving a container into Images", async () => {
    prepareMove("images");
    await expect(moveStorageItem(session, "folder", source, destination)).rejects.toMatchObject({ code: "IMAGE_FOLDER_CONTAINER_NOT_ALLOWED" });
  });

  it("keeps system folders immovable", async () => {
    prepareMove("custom", false, true);
    await expect(moveStorageItem(session, "folder", source, destination)).rejects.toMatchObject({ code: "SYSTEM_FOLDER_IMMUTABLE" });
  });
});
