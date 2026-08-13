import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { deletePrivateObjectsAndVerify } from "../../src/server/attachments/object-storage.js";

describe("AI attachment hard-delete contract", () => {
  it("deletes and verifies every R2 object before removing PostgreSQL content", async () => {
    const [service, storage] = await Promise.all([
      readFile("src/server/attachments/service.js", "utf8"),
      readFile("src/server/attachments/object-storage.js", "utf8")
    ]);
    expect(service).toContain("status='deleting'");
    expect(service).toContain("deletePrivateObjectsAndVerify([row.objectKey, ...(row.derivedObjectKeys || [])])");
    expect(service.indexOf("deletePrivateObjectsAndVerify")).toBeLessThan(service.indexOf("DELETE FROM ai_attachments"));
    expect(service).toContain("تم حذف المرفق");
    expect(storage).toContain("privateObjectExists");
    expect(storage).toContain("R2_DELETE_NOT_VERIFIED");
  });

  it("verifies original and derived objects are absent and rejects a surviving object", async () => {
    const objects = new Set(["original", "thumbnail", "derived"]);
    const clientImpl = {
      async send(command: { constructor: { name: string }, input: { Key: string } }) {
        if (command.constructor.name === "DeleteObjectCommand") objects.delete(command.input.Key);
        if (command.constructor.name === "HeadObjectCommand" && !objects.has(command.input.Key)) {
          throw Object.assign(new Error("not found"), { $metadata: { httpStatusCode: 404 } });
        }
        return {};
      }
    };
    await expect(deletePrivateObjectsAndVerify(["original", "thumbnail", "derived"], {
      clientImpl, bucket: "private"
    })).resolves.toEqual({ deleted: 3, verifiedAbsent: true });

    const survivingClient = {
      async send(command: { constructor: { name: string } }) {
        if (command.constructor.name === "HeadObjectCommand") return {};
        return {};
      }
    };
    await expect(deletePrivateObjectsAndVerify(["survivor"], {
      clientImpl: survivingClient, bucket: "private"
    })).rejects.toMatchObject({ code: "R2_DELETE_NOT_VERIFIED", remainingCount: 1 });
  });

  it("keeps only content-free deletion and financial audit records", async () => {
    const migration = await readFile("drizzle/0084_ai_media_usage_and_hard_delete.sql", "utf8");
    const tombstone = migration.slice(
      migration.indexOf("CREATE TABLE IF NOT EXISTS attachment_deletion_tombstones"),
      migration.indexOf("CREATE TABLE IF NOT EXISTS storage_cleanup_jobs")
    );
    expect(tombstone).not.toContain("original_name");
    expect(tombstone).not.toContain("object_key");
    expect(tombstone).not.toContain("transcript");
    expect(migration).toContain("UNIQUE(provider,provider_request_id)");
    expect(migration).toContain("quota_conversion_version");
  });

  it("provides idempotent jobs, bounded batches, retries, and reconciliation", async () => {
    const jobs = await readFile("src/server/attachments/cleanup-jobs.js", "utf8");
    expect(jobs).toContain("attempts<3");
    expect(jobs).toContain("FOR UPDATE SKIP LOCKED LIMIT $2");
    expect(jobs).toContain("reconcileDeletingAttachments");
    expect(jobs).toContain("CLEANUP_CATEGORY_PROTECTED");
  });
});
