import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { hashStorageShareToken, isStorageShareToken, normalizeStorageSharePermission } from "../../src/server/storage-document-shares.js";

describe("storage document sharing", () => {
  it("accepts only full-entropy base64url bearer tokens", () => {
    const token = Buffer.alloc(32, 17).toString("base64url");
    expect(token).toHaveLength(43);
    expect(isStorageShareToken(token)).toBe(true);
    expect(isStorageShareToken("short-token")).toBe(false);
    expect(hashStorageShareToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashStorageShareToken(token)).not.toContain(token);
  });

  it("allows only explicit view and edit permissions", () => {
    expect(normalizeStorageSharePermission("view")).toBe("view");
    expect(normalizeStorageSharePermission("edit")).toBe("edit");
    expect(() => normalizeStorageSharePermission("owner")).toThrow("عرض فقط أو تعديل");
  });

  it("keeps public access passwordless while owner controls stay authenticated", () => {
    const ownerRoute = fs.readFileSync(path.join(process.cwd(), "app/api/storage/documents/[documentId]/share/route.js"), "utf8");
    const publicRoute = fs.readFileSync(path.join(process.cwd(), "app/api/public/storage-documents/[token]/route.js"), "utf8");
    const service = fs.readFileSync(path.join(process.cwd(), "src/server/storage-document-shares.js"), "utf8");
    expect(ownerRoute).toContain("requireSession");
    expect(ownerRoute).toContain("sameOriginRequest");
    expect(publicRoute).not.toContain("requireSession");
    expect(publicRoute).toContain("sameOriginRequest");
    expect(service).toContain("d.type IN ('note','custom')");
    expect(service).not.toContain("password_encrypted");
    expect(service).not.toContain("code_encrypted");
  });

  it("stores a digest plus encrypted recovery copy instead of a plaintext token", () => {
    const migration = fs.readFileSync(path.join(process.cwd(), "drizzle/0099_storage_document_shares.sql"), "utf8");
    expect(migration).toContain("token_hash text NOT NULL UNIQUE");
    expect(migration).toContain("token_encrypted jsonb NOT NULL");
    expect(migration).toContain("revoked_at timestamptz");
    expect(migration).not.toMatch(/token\s+text/i);
  });

  it("renders permission-aware public editing and no-index metadata", () => {
    const app = fs.readFileSync(path.join(process.cwd(), "src/app/app.js"), "utf8");
    const page = fs.readFileSync(path.join(process.cwd(), "app/[[...slug]]/page.jsx"), "utf8");
    expect(app).toContain('item.permission === "edit"');
    expect(app).toContain('data-submit="shared-storage-document"');
    expect(app).toContain("storage-share-revoke");
    expect(page).toContain('slug[0] === "shared"');
    expect(page).toContain("index: false, follow: false");
  });
});
