import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { chromium } from "playwright";

const baseURL = process.env.STORAGE_E2E_BASE_URL || "http://localhost:3069";
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false }
});
const token = crypto.randomBytes(32).toString("base64url");
const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
const suffix = `${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
const folderName = `فحص مركز التخزين ${suffix}`;
const childName = `مجلد داخلي ${suffix}`;
const documentTitle = `حساب اختبار ${suffix}`;
const createdIds = [];
const createdFolderIds = [];
const createdDocumentIds = [];
let sessionId = "";
let browser;

function assert(value, message) {
  if (!value) throw new Error(message);
}

await client.connect();
try {
  const user = await client.query(
    `SELECT u.id,u.tenant_id AS "tenantId" FROM users u
      JOIN tenants t ON t.id=u.tenant_id AND t.status<>'disabled'
     ORDER BY u.created_at ASC LIMIT 1`
  );
  assert(user.rows[0], "No active development user is available for the storage smoke test.");
  const insertedSession = await client.query(
    `INSERT INTO sessions(user_id,token,expires_at,user_agent)
     VALUES($1,$2,now()+interval '20 minutes','storage-center-smoke') RETURNING id`,
    [user.rows[0].id, tokenHash]
  );
  sessionId = insertedSession.rows[0].id;

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: "ar-SA", viewport: { width: 1440, height: 1050 } });
  await context.addCookies([{ name: "renewpilot_session", value: token, url: baseURL, httpOnly: true, sameSite: "Lax" }]);
  const page = await context.newPage();
  await page.goto(`${baseURL}/dashboard/storage`, { waitUntil: "domcontentloaded" });
  await page.locator(".storage-center h1", { hasText: "مركز التخزين" }).waitFor();
  await page.locator('[data-link="/dashboard/storage"]').waitFor();

  const api = (url, options = {}) => page.evaluate(async ({ url, options }) => {
    const response = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) }
    });
    const payload = await response.json().catch(() => ({}));
    return { status: response.status, payload };
  }, { url, options });

  const parent = await api("/api/storage/folders", { method: "POST", body: JSON.stringify({ name: folderName, description: "عنصر مؤقت لاختبار مركز التخزين" }) });
  assert(parent.status === 201 && parent.payload.folder?.id, `Parent folder creation failed (${parent.status}).`);
  createdIds.push(parent.payload.folder.id);
  createdFolderIds.push(parent.payload.folder.id);
  const child = await api("/api/storage/folders", { method: "POST", body: JSON.stringify({ name: childName, parentId: parent.payload.folder.id }) });
  assert(child.status === 201 && child.payload.folder?.id, `Nested folder creation failed (${child.status}).`);
  createdIds.push(child.payload.folder.id);
  createdFolderIds.push(child.payload.folder.id);

  const document = await api("/api/storage/documents", {
    method: "POST",
    body: JSON.stringify({
      type: "account",
      title: documentTitle,
      folderId: child.payload.folder.id,
      accountName: documentTitle,
      email: "storage-smoke@example.test",
      password: `secret-${suffix}`,
      code: "123456",
      fields: [{ label: "الدولة", value: "Saudi Arabia" }]
    })
  });
  assert(document.status === 201 && document.payload.document?.id, `Account document creation failed (${document.status}).`);
  createdIds.push(document.payload.document.id);
  createdDocumentIds.push(document.payload.document.id);

  const opened = await api(`/api/storage/documents/${document.payload.document.id}`);
  assert(opened.status === 200, "The encrypted account document could not be opened.");
  assert(opened.payload.document.password === `secret-${suffix}`, "The account password did not decrypt correctly.");
  const usage = await api("/api/storage/usage");
  const library = await api("/api/storage/assets");
  const search = await api(`/api/storage/search?q=${encodeURIComponent(documentTitle)}`);
  assert(usage.status === 200 && Number.isFinite(Number(usage.payload.usage?.usedBytes)), "The storage usage endpoint failed.");
  assert(library.status === 200 && Array.isArray(library.payload.assets), "The saved-image library endpoint failed.");
  assert(search.status === 200 && search.payload.documents?.some((item) => item.id === document.payload.document.id), "The tenant-scoped storage search failed.");
  const encrypted = await client.query(
    `SELECT password_encrypted::text AS value FROM storage_account_entries WHERE document_id=$1`,
    [document.payload.document.id]
  );
  assert(encrypted.rows[0]?.value && !encrypted.rows[0].value.includes(`secret-${suffix}`), "Sensitive account data was stored in plaintext.");

  const artifactDirectory = path.resolve("test-results-storage-center");
  await fs.mkdir(artifactDirectory, { recursive: true });
  await page.goto(`${baseURL}/dashboard/storage`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: folderName, exact: true }).waitFor();
  await page.screenshot({ path: path.join(artifactDirectory, "storage-center-overview.png"), fullPage: true });
  await page.goto(`${baseURL}/dashboard/storage?folder=${encodeURIComponent(child.payload.folder.id)}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: documentTitle, exact: true }).waitFor();
  await page.screenshot({ path: path.join(artifactDirectory, "storage-center.png"), fullPage: true });

  const trashed = await api(`/api/storage/folders/${parent.payload.folder.id}`, { method: "DELETE" });
  assert(trashed.status === 200, "Nested folder tree could not be moved to trash.");
  const restored = await api(`/api/storage/trash/${parent.payload.folder.id}/restore`, { method: "POST", body: JSON.stringify({ kind: "folder" }) });
  assert(restored.status === 200, "Nested folder tree could not be restored.");
  const reopened = await api(`/api/storage/documents/${document.payload.document.id}`);
  assert(reopened.status === 200, "Restoring the parent did not restore its nested document.");
  await api(`/api/storage/folders/${parent.payload.folder.id}`, { method: "DELETE" });
  const removed = await api(`/api/storage/trash/${parent.payload.folder.id}/permanent`, { method: "DELETE", body: JSON.stringify({ kind: "folder" }) });
  assert(removed.status === 200, `Deep permanent deletion failed (${removed.status}).`);

  const absent = await client.query(
    `SELECT
       (SELECT count(*)::int FROM storage_folders WHERE id=ANY($1::uuid[])) AS folders,
       (SELECT count(*)::int FROM storage_documents WHERE id=$2) AS documents`,
    [[parent.payload.folder.id, child.payload.folder.id], document.payload.document.id]
  );
  assert(absent.rows[0].folders === 0 && absent.rows[0].documents === 0, "Permanent deletion left nested database rows behind.");
  console.log(JSON.stringify({ ok: true, screenshots: [path.join(artifactDirectory, "storage-center-overview.png"), path.join(artifactDirectory, "storage-center.png")] }));
} finally {
  if (browser) await browser.close().catch(() => {});
  if (createdIds.length) await client.query("DELETE FROM storage_activity WHERE resource_id=ANY($1::uuid[])", [createdIds]).catch(() => {});
  if (createdDocumentIds.length) await client.query("DELETE FROM storage_documents WHERE id=ANY($1::uuid[])", [createdDocumentIds]).catch(() => {});
  for (const folderId of [...createdFolderIds].reverse()) {
    await client.query("DELETE FROM storage_folders WHERE id=$1", [folderId]).catch(() => {});
  }
  if (sessionId) await client.query("DELETE FROM sessions WHERE id=$1", [sessionId]).catch(() => {});
  await client.end();
}
