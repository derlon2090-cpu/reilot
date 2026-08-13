import crypto from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { query } from "../../src/server/db.js";
import { reconcileTenantStorageUsage } from "../../src/server/tenant-storage.js";

const storageMocks = vi.hoisted(() => ({ deletePrivateObjectsAndVerify: vi.fn() }));

vi.mock("../../src/server/attachments/object-storage.js", () => ({
  createPrivateDownload: vi.fn(),
  createPrivateUpload: vi.fn(),
  deletePrivateObject: vi.fn(),
  deletePrivateObjectsAndVerify: storageMocks.deletePrivateObjectsAndVerify,
  inspectPrivateObject: vi.fn(),
  readPrivateObjectPrefix: vi.fn()
}));

import { deleteAttachment } from "../../src/server/attachments/service.js";

const tenantId = crypto.randomUUID();
const userId = crypto.randomUUID();
const otherTenantId = crypto.randomUUID();
const otherUserId = crypto.randomUUID();
const conversationId = crypto.randomUUID();
const messageId = crypto.randomUUID();
const session = { tenantId, userId };

async function insertAttachment(id: string, suffix: string, sizeBytes = 4096) {
  await query(
    `INSERT INTO ai_attachments
      (id,tenant_id,user_id,conversation_id,message_id,object_key,derived_object_keys,original_name,mime_type,
       size_bytes,purpose,status,processing_status,content_sha256,transcript,transcript_language,
       transcript_confidence,transcript_segments,vision_result,analysis_provider,analysis_model)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,'image/png',$9,'image','processed','completed',$10,$11,'ar-SA',.95,
            $12::jsonb,$13::jsonb,'gemini','gemini-3.6-flash')`,
    [id, tenantId, userId, conversationId, messageId, `tests/${suffix}/original.png`,
      [`tests/${suffix}/thumbnail.webp`, `tests/${suffix}/derived.json`], `${suffix}.png`, sizeBytes,
      crypto.createHash("sha256").update(suffix).digest("hex"), "نص حساس مستخرج من الملف",
      JSON.stringify([{ start: 0, end: 1, text: "نص حساس مستخرج من الملف" }]),
      JSON.stringify({ type: "screenshot", summary: "تحليل حساس", confidence: 0.95 })]
  );
  await query(
    `UPDATE ai_messages SET attachments=$2::jsonb WHERE id=$1`,
    [messageId, JSON.stringify([{ id, name: `${suffix}.png`, size: sizeBytes, transcript: "نص حساس مستخرج من الملف" }])]
  );
  await reconcileTenantStorageUsage(tenantId);
}

describe.sequential("AI attachment hard delete with PostgreSQL and R2 boundary", () => {
  beforeAll(async () => {
    await query("INSERT INTO tenants(id,name,slug,status) VALUES($1,'Hard delete tenant',$2,'active')", [tenantId, `delete-${tenantId}`]);
    await query("INSERT INTO users(id,tenant_id,name,email,email_verified,role) VALUES($1,$2,'Delete User',$3,true,'owner')", [userId, tenantId, `delete-${userId}@example.test`]);
    await query("INSERT INTO tenants(id,name,slug,status) VALUES($1,'Other tenant',$2,'active')", [otherTenantId, `other-${otherTenantId}`]);
    await query("INSERT INTO users(id,tenant_id,name,email,email_verified,role) VALUES($1,$2,'Other User',$3,true,'owner')", [otherUserId, otherTenantId, `other-${otherUserId}@example.test`]);
    await query("INSERT INTO ai_conversations(id,tenant_id,user_id,title) VALUES($1,$2,$3,'Hard delete test')", [conversationId, tenantId, userId]);
    await query("INSERT INTO ai_messages(id,conversation_id,tenant_id,user_id,role,content) VALUES($1,$2,$3,$4,'user','احتفظ بالرسالة')", [messageId, conversationId, tenantId, userId]);
  });

  beforeEach(() => {
    storageMocks.deletePrivateObjectsAndVerify.mockReset();
    storageMocks.deletePrivateObjectsAndVerify.mockResolvedValue({ deleted: 3, verifiedAbsent: true });
  });

  afterAll(async () => {
    await query("DELETE FROM users WHERE id=$1", [userId]);
    await query("DELETE FROM users WHERE id=$1", [otherUserId]);
    await query("DELETE FROM tenant_storage_usage WHERE tenant_id=ANY($1::uuid[])", [[tenantId, otherTenantId]]);
    await query("DELETE FROM tenants WHERE id=$1", [tenantId]);
    await query("DELETE FROM tenants WHERE id=$1", [otherTenantId]);
  });

  it("removes original/derived objects, inline Vision/STT content, and frees quota while retaining the message", async () => {
    const attachmentId = crypto.randomUUID();
    await insertAttachment(attachmentId, "complete-delete", 4096);
    const before = await query("SELECT used_bytes AS bytes FROM tenant_storage_usage WHERE tenant_id=$1", [tenantId]);

    await expect(deleteAttachment({ tenantId: otherTenantId, userId: otherUserId }, attachmentId))
      .rejects.toMatchObject({ code: "ATTACHMENT_NOT_FOUND", status: 404 });
    expect(storageMocks.deletePrivateObjectsAndVerify).not.toHaveBeenCalled();

    await expect(deleteAttachment(session, attachmentId)).resolves.toMatchObject({ status: "deleted", idempotent: false });
    expect(storageMocks.deletePrivateObjectsAndVerify).toHaveBeenCalledWith([
      "tests/complete-delete/original.png",
      "tests/complete-delete/thumbnail.webp",
      "tests/complete-delete/derived.json"
    ]);

    const [attachment, tombstone, message, after] = await Promise.all([
      query("SELECT transcript,transcript_segments,vision_result,content_sha256,object_key FROM ai_attachments WHERE id=$1", [attachmentId]),
      query("SELECT freed_bytes AS bytes FROM attachment_deletion_tombstones WHERE attachment_id=$1", [attachmentId]),
      query("SELECT content,attachments FROM ai_messages WHERE id=$1", [messageId]),
      query("SELECT used_bytes AS bytes FROM tenant_storage_usage WHERE tenant_id=$1", [tenantId])
    ]);
    expect(attachment.rows).toHaveLength(0);
    expect(Number(tombstone.rows[0]?.bytes)).toBe(4096);
    expect(message.rows[0].content).toBe("احتفظ بالرسالة");
    expect(message.rows[0].attachments[0]).toEqual({ id: attachmentId, status: "deleted", deleted: true, name: "تم حذف المرفق" });
    expect(Number(before.rows[0].bytes) - Number(after.rows[0].bytes)).toBeGreaterThanOrEqual(4096);

    await expect(deleteAttachment(session, attachmentId)).resolves.toMatchObject({ status: "deleted", idempotent: true });
  });

  it("keeps PostgreSQL content in deleting state when R2 verification fails, then completes idempotently on retry", async () => {
    const attachmentId = crypto.randomUUID();
    await insertAttachment(attachmentId, "r2-retry", 2048);
    storageMocks.deletePrivateObjectsAndVerify.mockRejectedValueOnce(Object.assign(new Error("R2 failure"), { code: "R2_DELETE_NOT_VERIFIED" }));

    await expect(deleteAttachment(session, attachmentId)).rejects.toMatchObject({ code: "R2_DELETE_NOT_VERIFIED" });
    const retained = await query("SELECT status,transcript,vision_result FROM ai_attachments WHERE id=$1", [attachmentId]);
    expect(retained.rows[0]).toMatchObject({ status: "deleting", transcript: "نص حساس مستخرج من الملف" });
    expect(retained.rows[0].vision_result).not.toBeNull();

    await expect(deleteAttachment(session, attachmentId)).resolves.toMatchObject({ status: "deleted", idempotent: false });
    expect(storageMocks.deletePrivateObjectsAndVerify).toHaveBeenCalledTimes(2);
  });
});
