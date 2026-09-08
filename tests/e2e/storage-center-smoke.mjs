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
const documentTitle = `حساب اختبار ${suffix}`;
const textDocumentTitle = `مستند داخل المجلد ${suffix}`;
const textDocumentBody = `هذا محتوى المستند التجريبي ${suffix}`;
const createdIds = [];
const createdFolderIds = [];
const createdDocumentIds = [];
const artifactDirectory = path.resolve("test-results-storage-center");
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
  await fs.mkdir(artifactDirectory, { recursive: true });
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

  await page.locator('[data-action="storage-create-menu"]').click();
  await page.locator('#portal [data-action="storage-new-folder"]').click();
  const folderForm = page.locator('#portal form[data-submit="storage-folder"]');
  await folderForm.locator('[name="name"]').fill(folderName);
  await folderForm.locator('[name="description"]').fill("عنصر مؤقت لاختبار مركز التخزين");
  const folderResponsePromise = page.waitForResponse((response) => response.url().endsWith("/api/storage/folders") && response.request().method() === "POST");
  await folderForm.getByRole("button", { name: "إنشاء المجلد", exact: true }).click();
  const folderResponse = await folderResponsePromise;
  const parent = { status: folderResponse.status(), payload: await folderResponse.json() };
  assert(parent.status === 201 && parent.payload.folder?.id, `Folder creation through the UI failed (${parent.status}).`);
  await page.getByRole("heading", { name: folderName, exact: true }).waitFor();
  createdIds.push(parent.payload.folder.id);
  createdFolderIds.push(parent.payload.folder.id);
  await page.getByRole("heading", { name: folderName, exact: true }).click();
  await page.locator(".storage-page-heading h1", { hasText: folderName }).waitFor();
  await page.locator('[data-action="storage-create-menu"]').click();
  assert(await page.locator('#portal [data-action="storage-new-folder"]').count() === 0, "Nested folder creation is still offered inside a content folder.");
  assert(await page.locator("#portal .storage-type-picker > button").count() === 1, "A content folder still offers actions other than creating a text document.");
  assert(await page.locator('#portal [data-action="storage-upload-trigger"], #portal [data-action="storage-upload-files-trigger"], #portal [data-action="storage-create-account"], #portal [data-action="storage-create-note"]').count() === 0, "A content folder still allows non-document content.");
  await page.locator('#portal [data-action="storage-create-document"]').click();
  const textDocumentForm = page.locator('form[data-submit="storage-document"]');
  assert(await textDocumentForm.locator('[data-action="storage-editor-color"]').count() === 6, "The document editor color palette is missing.");
  await textDocumentForm.getByRole("button", { name: "ترتيب النص بالذكاء الاصطناعي", exact: true }).waitFor();
  await textDocumentForm.locator('[name="title"]').fill(textDocumentTitle);
  await textDocumentForm.locator('[data-storage-editor]').fill(textDocumentBody);
  await page.setViewportSize({ width: 768, height: 1024 });
  const aiButtonBox = await textDocumentForm.getByRole("button", { name: "ترتيب النص بالذكاء الاصطناعي", exact: true }).boundingBox();
  assert(aiButtonBox?.width > 500, "The AI formatting action is not clear and full-width on iPad portrait.");
  await page.screenshot({ path: path.join(artifactDirectory, "storage-document-editor-ipad.png"), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1050 });
  const textDocumentResponsePromise = page.waitForResponse((response) => response.url().endsWith("/api/storage/documents") && response.request().method() === "POST");
  await textDocumentForm.getByRole("button", { name: "حفظ", exact: true }).click();
  const textDocumentResponse = await textDocumentResponsePromise;
  const textDocumentPayload = await textDocumentResponse.json();
  assert(textDocumentResponse.status() === 201 && textDocumentPayload.document?.folderId === parent.payload.folder.id, "The text document was not saved inside the open folder.");
  createdIds.push(textDocumentPayload.document.id);
  createdDocumentIds.push(textDocumentPayload.document.id);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(".storage-page-heading h1", { hasText: folderName }).waitFor();
  const textDocumentCard = page.locator(".storage-document-card", { hasText: textDocumentTitle });
  await textDocumentCard.getByRole("button", { name: "عرض المحتوى", exact: true }).click();
  await page.getByRole("heading", { name: textDocumentTitle, exact: true }).waitFor();
  assert(new URL(page.url()).searchParams.get("document") === textDocumentPayload.document.id, "Opening the document did not create a stable document URL.");
  await page.getByText(textDocumentBody, { exact: true }).waitFor();
  await page.locator('[data-action="storage-close-document"]').click();
  assert(!new URL(page.url()).searchParams.has("document"), "Closing the document left the document URL active.");
  await textDocumentCard.locator('[data-action="storage-item-menu"]').click();
  await page.locator('#portal [data-action="storage-delete-item"][data-kind="document"]').click();
  const documentDeleteResponsePromise = page.waitForResponse((response) => response.url().endsWith(`/api/storage/documents/${textDocumentPayload.document.id}`) && response.request().method() === "DELETE");
  await page.locator('#portal [data-action="storage-confirm-delete"][data-kind="document"]').click();
  const documentDeleteResponse = await documentDeleteResponsePromise;
  const documentDeletePayload = await documentDeleteResponse.json();
  assert(documentDeleteResponse.status() === 200 && documentDeletePayload.item?.retentionDays === 15, "Document deletion did not enter the 15-day trash retention flow.");
  await textDocumentCard.waitFor({ state: "hidden" });
  const deletedDocumentRow = await client.query("SELECT deleted_at AS \"deletedAt\" FROM storage_documents WHERE id=$1", [textDocumentPayload.document.id]);
  assert(deletedDocumentRow.rows[0]?.deletedAt, "The deleted document remained active in the database.");
  await page.locator('[data-action="storage-open-trash"]').first().click();
  const trashedDocument = page.locator("#portal .storage-trash-list article", { hasText: textDocumentTitle });
  await trashedDocument.waitFor();
  const trashedDocumentText = await trashedDocument.textContent();
  assert(trashedDocumentText?.includes("الحذف النهائي خلال") && trashedDocumentText.includes("يوم"), `Trash UI did not explain the remaining retention period (${trashedDocumentText}).`);
  const trashPayload = await api("/api/storage/trash");
  const retainedDocument = trashPayload.payload.items?.find((item) => item.id === textDocumentPayload.document.id);
  const retentionMs = new Date(retainedDocument?.expiresAt || 0).getTime() - new Date(retainedDocument?.deletedAt || 0).getTime();
  assert(trashPayload.status === 200 && retentionMs === 15 * 86400000, "Trash API did not expose an exact 15-day document retention window.");
  const documentRestoreResponsePromise = page.waitForResponse((response) => response.url().includes(`/api/storage/trash/${textDocumentPayload.document.id}/restore`) && response.request().method() === "POST");
  await trashedDocument.getByRole("button", { name: "استعادة", exact: true }).click();
  assert((await documentRestoreResponsePromise).status() === 200, "Document restoration failed.");
  await textDocumentCard.waitFor({ state: "visible" });
  const restoredDocumentRow = await client.query("SELECT deleted_at AS \"deletedAt\" FROM storage_documents WHERE id=$1", [textDocumentPayload.document.id]);
  assert(restoredDocumentRow.rows[0]?.deletedAt === null, "Restored document is still marked as deleted.");
  const child = await api("/api/storage/folders", { method: "POST", body: JSON.stringify({ name: `مجلد داخلي ${suffix}`, parentId: parent.payload.folder.id }) });
  assert(child.status === 409 && child.payload.code === "NESTED_FOLDER_NOT_ALLOWED", "The API still allows a folder to be created inside another folder.");

  const document = await api("/api/storage/documents", {
    method: "POST",
    body: JSON.stringify({
      type: "account",
      title: documentTitle,
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

  const pinned = await api(`/api/storage/folders/${parent.payload.folder.id}`, { method: "PATCH", body: JSON.stringify({ pinned: true }) });
  assert(pinned.status === 200 && pinned.payload.item?.isPinned === true, "The important folder could not be pinned.");
  const largestFolders = await api("/api/storage?type=folder&sort=size");
  const measuredParent = largestFolders.payload.storage?.folders?.find((item) => item.id === parent.payload.folder.id);
  assert(largestFolders.status === 200 && measuredParent?.isPinned === true, "Pinned folders were not returned by the filtered storage view.");
  assert(Number(measuredParent?.sizeBytes || 0) > 0, "Recursive folder size did not include its nested document.");

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

  await page.goto(`${baseURL}/dashboard/storage`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: folderName, exact: true }).waitFor();
  await page.locator('[data-action="storage-usage-details"]').first().click();
  await page.getByRole("heading", { name: "إدارة مساحة التخزين", exact: true }).waitFor();
  await page.getByText("كل ما يستهلك المساحة", { exact: true }).waitFor();
  await page.getByText("تفصيل كامل محسوب من بيانات الحساب الفعلية.", { exact: true }).waitFor();
  await page.locator("#portal").getByText("أكبر الملفات", { exact: true }).waitFor();
  await page.locator("#portal").getByText("الملفات القديمة", { exact: true }).waitFor();
  await page.locator("#portal").getByText("الصور غير المستخدمة", { exact: true }).waitFor();
  await page.locator("#portal").getByText("الملفات المكررة", { exact: true }).waitFor();
  await page.locator("#portal .storage-management-opportunities").getByText("سلة المحذوفات", { exact: true }).waitFor();
  await page.screenshot({ path: path.join(artifactDirectory, "storage-space-management.png"), fullPage: true });
  await page.locator("#portal .storage-management-cleanup").click();
  await page.getByRole("heading", { name: "إخلاء مساحة", exact: true }).waitFor();
  await page.getByText("هذه الشاشة لا تحذف تلقائيًا", { exact: false }).waitFor();
  await page.screenshot({ path: path.join(artifactDirectory, "storage-cleanup-review.png"), fullPage: true });
  await page.locator('#portal [data-action="open-account-storage-cleanup"]').click();
  await page.getByRole("heading", { name: "تنظيف السجلات والمحادثات القديمة", exact: true }).waitFor();
  await page.locator('[data-action="close-account-storage-cleanup"]').last().click();
  await page.goto(`${baseURL}/dashboard/settings`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "حد التخزين في الباقة", exact: true }).waitFor();
  assert(await page.locator('[data-action="open-account-storage-cleanup"]').count() === 0, "Settings still exposes the cleanup action.");
  await page.locator('[data-link="/dashboard/storage"]').last().waitFor();
  await page.goto(`${baseURL}/dashboard/storage`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: folderName, exact: true }).waitFor();
  await page.screenshot({ path: path.join(artifactDirectory, "storage-center-overview.png"), fullPage: true });
  for (const viewport of [{ width: 1024, height: 768, name: "landscape" }, { width: 768, height: 1024, name: "portrait" }]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`${baseURL}/dashboard/storage`, { waitUntil: "domcontentloaded" });
    await page.locator(".storage-stats article").first().waitFor();
    const tabletLayout = await page.evaluate(() => {
      const stats = [...document.querySelectorAll(".storage-stats article")].map((card) => card.getBoundingClientRect());
      const items = document.querySelector(".storage-items.grid");
      return {
        count: stats.length,
        topSpread: Math.max(...stats.map((box) => box.top)) - Math.min(...stats.map((box) => box.top)),
        widths: stats.map((box) => box.width),
        itemColumns: items ? getComputedStyle(items).gridTemplateColumns.split(" ").filter(Boolean).length : 0
      };
    });
    assert(tabletLayout.count === 5, `The ${viewport.name} storage summary did not render all five cards.`);
    assert(tabletLayout.topSpread <= 2, `The ${viewport.name} storage summary wrapped onto more than one row.`);
    assert(tabletLayout.widths.slice(0, 4).every((width) => width >= 150), `The ${viewport.name} summary cards became too narrow.`);
    assert(tabletLayout.widths[4] >= 265, `The ${viewport.name} storage-capacity card is not wide enough.`);
    assert(tabletLayout.itemColumns === 3, `The ${viewport.name} content cards are not balanced across three columns.`);
    await page.screenshot({ path: path.join(artifactDirectory, `storage-center-ipad-${viewport.name}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto(`${baseURL}/dashboard/storage?folder=${encodeURIComponent(parent.payload.folder.id)}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: textDocumentTitle, exact: true }).waitFor();
  await page.screenshot({ path: path.join(artifactDirectory, "storage-center.png"), fullPage: true });

  const trashed = await api(`/api/storage/folders/${parent.payload.folder.id}`, { method: "DELETE" });
  assert(trashed.status === 200, "Nested folder tree could not be moved to trash.");
  const restored = await api(`/api/storage/trash/${parent.payload.folder.id}/restore`, { method: "POST", body: JSON.stringify({ kind: "folder" }) });
  assert(restored.status === 200, "Nested folder tree could not be restored.");
  const reopened = await api(`/api/storage/documents/${textDocumentPayload.document.id}`);
  assert(reopened.status === 200, "Restoring the folder did not restore its text document.");
  await api(`/api/storage/folders/${parent.payload.folder.id}`, { method: "DELETE" });
  const removed = await api(`/api/storage/trash/${parent.payload.folder.id}/permanent`, { method: "DELETE", body: JSON.stringify({ kind: "folder" }) });
  assert(removed.status === 200, `Deep permanent deletion failed (${removed.status}).`);

  const absent = await client.query(
    `SELECT
       (SELECT count(*)::int FROM storage_folders WHERE id=ANY($1::uuid[])) AS folders,
       (SELECT count(*)::int FROM storage_documents WHERE id=$2) AS documents`,
    [[parent.payload.folder.id], textDocumentPayload.document.id]
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
