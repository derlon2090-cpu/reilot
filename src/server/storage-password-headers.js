const BASE64URL = /^[A-Za-z0-9_-]+$/;

export function decodeStoragePasswordHeader(value, maxBytes = 16_384) {
  const encoded = String(value || "").trim();
  if (!encoded || encoded.length > Math.ceil(maxBytes * 4 / 3) + 8 || !BASE64URL.test(encoded)) return "";
  try {
    const bytes = Buffer.from(encoded, "base64url");
    if (!bytes.length || bytes.length > maxBytes || bytes.toString("base64url") !== encoded) return "";
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return "";
  }
}

export function storageDocumentPasswordFromRequest(request) {
  const encoded = request.headers.get("x-storage-document-password-b64");
  if (encoded) return decodeStoragePasswordHeader(encoded, 1024);
  return request.headers.get("x-storage-document-password") || "";
}
