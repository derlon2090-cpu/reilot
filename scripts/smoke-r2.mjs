import crypto from "node:crypto";
import {
  createPrivateDownload,
  createPrivateUpload,
  deletePrivateObjectsAndVerify,
  inspectPrivateObject,
  objectStorageConfigured,
  privateObjectExists
} from "../src/server/attachments/object-storage.js";

function fail(code, message) {
  process.stderr.write(`${JSON.stringify({ ok: false, code, message })}\n`);
  process.exitCode = 1;
}

if (!objectStorageConfigured()) {
  fail("R2_SMOKE_DISABLED", "R2 server-side configuration is incomplete. No object operation was attempted.");
} else {
  const objectKey = `production/live-verification/${crypto.randomUUID()}.txt`;
  const payload = Buffer.from(`renvix-r2-live-check:${crypto.randomUUID()}`, "utf8");
  let created = false;
  try {
    const upload = await createPrivateUpload({
      objectKey,
      contentType: "text/plain",
      size: payload.length
    });
    const uploadResponse = await fetch(upload.url, {
      method: upload.method,
      headers: upload.headers,
      body: payload
    });
    if (!uploadResponse.ok) throw Object.assign(new Error("Presigned upload failed"), { code: "R2_UPLOAD_FAILED" });
    created = true;

    const head = await inspectPrivateObject(objectKey);
    if (head.size !== payload.length || head.contentType !== "text/plain") {
      throw Object.assign(new Error("HEAD metadata mismatch"), { code: "R2_HEAD_MISMATCH" });
    }

    const download = await createPrivateDownload(objectKey, { filename: "r2-live-check.txt" });
    const downloadResponse = await fetch(download.url, { headers: { "Cache-Control": "no-store" } });
    if (!downloadResponse.ok) throw Object.assign(new Error("Private download failed"), { code: "R2_DOWNLOAD_FAILED" });
    const downloaded = Buffer.from(await downloadResponse.arrayBuffer());
    if (downloaded.length !== payload.length || !crypto.timingSafeEqual(downloaded, payload)) {
      throw Object.assign(new Error("Downloaded bytes mismatch"), { code: "R2_DOWNLOAD_MISMATCH" });
    }

    const deletion = await deletePrivateObjectsAndVerify([objectKey]);
    created = false;
    if (!deletion.verifiedAbsent || await privateObjectExists(objectKey)) {
      throw Object.assign(new Error("Object still exists after deletion"), { code: "R2_DELETE_NOT_VERIFIED" });
    }

    process.stdout.write(`${JSON.stringify({
      ok: true,
      provider: "r2",
      upload: "PASS",
      head: "PASS",
      privateDownload: "PASS",
      bytesVerified: "PASS",
      delete: "PASS"
    })}\n`);
  } catch (error) {
    fail(error?.code || "R2_SMOKE_FAILED", "R2 live lifecycle verification failed. No credential or object key was logged.");
  } finally {
    if (created) await deletePrivateObjectsAndVerify([objectKey]).catch(() => {});
  }
}
