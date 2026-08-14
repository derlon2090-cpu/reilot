import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const UPLOAD_TTL_SECONDS = 5 * 60;
const DOWNLOAD_TTL_SECONDS = 2 * 60;
let client;

export function resolveObjectStorageEndpoint({
  accountId = process.env.R2_ACCOUNT_ID,
  endpoint = process.env.R2_ENDPOINT
} = {}) {
  const normalizedAccountId = String(accountId || "").trim();
  if (normalizedAccountId) {
    return `https://${normalizedAccountId}.r2.cloudflarestorage.com`;
  }
  return String(endpoint || "").trim().replace(/\/$/, "");
}

function configuration() {
  const accountId = String(process.env.R2_ACCOUNT_ID || "").trim();
  const accessKeyId = String(process.env.R2_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = String(process.env.R2_SECRET_ACCESS_KEY || "").trim();
  const bucket = String(process.env.R2_BUCKET_NAME || "").trim();
  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    endpoint: resolveObjectStorageEndpoint({ accountId, endpoint: process.env.R2_ENDPOINT })
  };
}

export function objectStorageConfigured() {
  const config = configuration();
  return Boolean(config.endpoint && config.accessKeyId && config.secretAccessKey && config.bucket);
}

function storageClient() {
  if (!objectStorageConfigured()) {
    throw Object.assign(new Error("تخزين المرفقات غير مهيأ حاليًا."), { code: "R2_UNAVAILABLE", status: 503 });
  }
  if (!client) {
    const config = configuration();
    client = new S3Client({
      region: "auto",
      endpoint: config.endpoint,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }
    });
  }
  return client;
}

function bucketName() {
  return configuration().bucket;
}

export async function createPrivateUpload({ objectKey, contentType, size }) {
  const command = new PutObjectCommand({
    Bucket: bucketName(),
    Key: objectKey,
    ContentType: contentType,
    ContentLength: size
  });
  const url = await getSignedUrl(storageClient(), command, { expiresIn: UPLOAD_TTL_SECONDS });
  return {
    url,
    method: "PUT",
    expiresAt: new Date(Date.now() + UPLOAD_TTL_SECONDS * 1000).toISOString(),
    headers: { "Content-Type": contentType }
  };
}

export async function inspectPrivateObject(objectKey) {
  const result = await storageClient().send(new HeadObjectCommand({ Bucket: bucketName(), Key: objectKey }));
  return {
    size: Number(result.ContentLength || 0),
    contentType: String(result.ContentType || ""),
    etag: String(result.ETag || "").replace(/^"|"$/g, ""),
    metadata: result.Metadata || {}
  };
}

export async function createPrivateDownload(objectKey, { filename = "attachment", disposition = "attachment" } = {}) {
  const safeFilename = String(filename).replace(/[\r\n"\\]/g, "_").slice(0, 160);
  const command = new GetObjectCommand({
    Bucket: bucketName(),
    Key: objectKey,
    ResponseCacheControl: "private, max-age=60",
    ResponseContentDisposition: `${disposition}; filename*=UTF-8''${encodeURIComponent(safeFilename)}`
  });
  return {
    url: await getSignedUrl(storageClient(), command, { expiresIn: DOWNLOAD_TTL_SECONDS }),
    expiresAt: new Date(Date.now() + DOWNLOAD_TTL_SECONDS * 1000).toISOString()
  };
}

export async function readPrivateObject(objectKey) {
  const result = await storageClient().send(new GetObjectCommand({ Bucket: bucketName(), Key: objectKey }));
  if (!result.Body) return Buffer.alloc(0);
  return Buffer.from(await result.Body.transformToByteArray());
}

export async function readPrivateObjectPrefix(objectKey, bytes = 32) {
  const length = Math.max(1, Math.min(512, Number(bytes || 32)));
  const result = await storageClient().send(new GetObjectCommand({
    Bucket: bucketName(), Key: objectKey, Range: `bytes=0-${length - 1}`
  }));
  if (!result.Body) return Buffer.alloc(0);
  return Buffer.from(await result.Body.transformToByteArray());
}

export async function deletePrivateObject(objectKey) {
  if (!objectKey || !objectStorageConfigured()) return;
  await storageClient().send(new DeleteObjectCommand({ Bucket: bucketName(), Key: objectKey }));
}

export async function privateObjectExists(objectKey, { clientImpl = null, bucket = null } = {}) {
  if (!objectKey) return false;
  try {
    await (clientImpl || storageClient()).send(new HeadObjectCommand({ Bucket: bucket || bucketName(), Key: objectKey }));
    return true;
  } catch (error) {
    const status = Number(error?.$metadata?.httpStatusCode || 0);
    if (status === 404 || error?.name === "NotFound" || error?.name === "NoSuchKey") return false;
    throw error;
  }
}

export async function deletePrivateObjectsAndVerify(objectKeys = [], { clientImpl = null, bucket = null } = {}) {
  const keys = [...new Set((Array.isArray(objectKeys) ? objectKeys : [])
    .map((key) => String(key || "").trim()).filter(Boolean))];
  if (!keys.length) return { deleted: 0, verifiedAbsent: true };
  if (!clientImpl && !objectStorageConfigured()) {
    throw Object.assign(new Error("تخزين المرفقات غير متاح لإكمال الحذف الموثوق."), {
      code: "R2_UNAVAILABLE", status: 503
    });
  }
  const activeClient = clientImpl || storageClient();
  const activeBucket = bucket || bucketName();
  for (const key of keys) {
    await activeClient.send(new DeleteObjectCommand({ Bucket: activeBucket, Key: key }));
  }
  const remaining = [];
  for (const key of keys) {
    if (await privateObjectExists(key, { clientImpl: activeClient, bucket: activeBucket })) remaining.push(key);
  }
  if (remaining.length) {
    throw Object.assign(new Error("تعذر التحقق من حذف بعض كائنات المرفق."), {
      code: "R2_DELETE_NOT_VERIFIED", status: 502, remainingCount: remaining.length
    });
  }
  return { deleted: keys.length, verifiedAbsent: true };
}

export async function objectStorageHealth() {
  if (!objectStorageConfigured()) return { objectStorage: "unconfigured" };
  try {
    await storageClient().send(new HeadBucketCommand({ Bucket: bucketName() }));
    return { objectStorage: "healthy" };
  } catch (error) {
    return { objectStorage: "unhealthy", error: String(error?.name || "R2HealthCheckFailed") };
  }
}
