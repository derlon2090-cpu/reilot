import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("storage folder sharing", () => {
  it("stores one revocable encrypted link for each folder", () => {
    const migration = read("drizzle/0100_storage_folder_shares.sql");
    expect(migration).toContain("folder_id uuid NOT NULL UNIQUE");
    expect(migration).toContain("token_hash text NOT NULL UNIQUE");
    expect(migration).toContain("token_encrypted jsonb NOT NULL");
    expect(migration).toContain("permission IN ('view','edit')");
    expect(migration).toContain("revoked_at timestamptz");
  });

  it("self-heals the folder share schema and includes it in traced deployments", () => {
    const schema = read("src/server/storage-folder-share-schema.js");
    const config = read("next.config.mjs");
    expect(schema).toContain('const STORAGE_FOLDER_SHARE_MIGRATION_NAME = "0100_storage_folder_shares.sql"');
    expect(schema).toContain("runMigrationPlan");
    expect(schema).toContain("schemaReadyPromise = undefined");
    expect(config.match(/\.\/drizzle\/0100_storage_folder_shares\.sql/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("excludes secrets and locked content from the public tree", () => {
    const service = read("src/server/storage-folder-shares.js");
    expect(service).toContain("document.type IN ('note','custom')");
    expect(service).toContain("storage_document_locks");
    expect(service).toContain("storage_folder_locks");
    expect(service).not.toContain("password_encrypted");
    expect(service).not.toContain("code_encrypted");
    expect(service).toContain("FOR UPDATE OF share,folder");
    expect(service).toContain("DOCUMENT_VERSION_CONFLICT");
  });

  it("provides authenticated owner controls and passwordless public aliases", () => {
    const owner = read("app/api/storage/folders/[folderId]/share/route.js");
    const publicList = read("app/api/public/storage-folders/[token]/route.js");
    const publicDocument = read("app/api/public/storage-folders/[token]/documents/[documentId]/route.js");
    const ownerAlias = read("app/storage-api/folders/[folderId]/share/route.js");
    const publicAlias = read("app/storage-api/public/storage-folders/[token]/documents/[documentId]/route.js");
    expect(owner).toContain("requireSession");
    expect(owner).toContain("sameOriginRequest");
    expect(owner).toContain("/shared/folder/");
    expect(publicList).not.toContain("requireSession");
    expect(publicDocument).toContain("sameOriginRequest");
    expect(publicDocument).toContain("updatePublicStorageFolderDocument");
    expect(ownerAlias).toContain("DELETE, GET, POST");
    expect(publicAlias).toContain("GET, PATCH");
  });

  it("renders a searchable folder browser with on-demand document editing", () => {
    const app = read("src/app/app.js");
    const styles = read("src/styles/globals.css");
    const middleware = read("middleware.js");
    expect(app).toContain('data-action="storage-share-folder"');
    expect(app).toContain("function sharedStorageFolderPage()");
    expect(app).toContain('data-action="shared-folder-search"');
    expect(app).toContain('data-submit="shared-storage-folder-document"');
    expect(app).toContain("openSharedFolderDocument");
    expect(styles).toContain(".shared-folder-browser");
    expect(styles).toContain(".shared-folder-privacy-note");
    expect(middleware).toContain("sharedFolderPage");
  });
});
