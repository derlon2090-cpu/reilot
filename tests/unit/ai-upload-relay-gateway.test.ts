import { afterEach, describe, expect, it, vi } from "vitest";
import { relaySignedAttachmentUpload } from "../../app/backend/ai/attachments/[attachmentId]/upload/route.js";

const originalApiOrigin = process.env.NEXT_PUBLIC_API_BASE_URL;
const attachmentId = "28d08f50-236c-4f50-86e0-0ff2efad463b";
const signedUrl = `https://renvix.0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com/production/chat/tenant/conversation/${attachmentId}.webm?X-Amz-Credential=short-lived&X-Amz-Expires=300&X-Amz-Signature=signed`;

function uploadRequest(overrides: { origin?: string; url?: string; size?: number } = {}) {
  const size = overrides.size ?? 4;
  return new Request(`https://renvix.app/backend/ai/attachments/${attachmentId}/upload`, {
    method: "PUT",
    headers: {
      Origin: overrides.origin || "https://renvix.app",
      "Sec-Fetch-Site": overrides.origin === "https://evil.example" ? "cross-site" : "same-origin",
      "Content-Type": "audio/webm",
      "Content-Length": String(size),
      "X-Renvix-Upload-Url": overrides.url || signedUrl,
      Cookie: "renvix_session=test-session"
    },
    body: new Uint8Array(Math.min(size, 4))
  });
}

afterEach(() => {
  if (originalApiOrigin === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
  else process.env.NEXT_PUBLIC_API_BASE_URL = originalApiOrigin;
});

describe("same-origin signed attachment upload gateway", () => {
  it("verifies ownership, relays only to the signed R2 object, then requires backend completion", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.renvix.app";
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(Response.json({ ok: false, code: "ATTACHMENT_NOT_READY" }, { status: 409 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(Response.json({ ok: true, attachment: { id: attachmentId, status: "ready" } }));
    const response = await relaySignedAttachmentUpload(
      uploadRequest(),
      { params: Promise.resolve({ attachmentId }) },
      fetchImpl
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ attachment: { id: attachmentId, status: "ready" } });
    expect(String(fetchImpl.mock.calls[0][0])).toBe(`https://api.renvix.app/api/ai/attachments?id=${attachmentId}`);
    expect(new Headers(fetchImpl.mock.calls[0][1].headers).get("cookie")).toContain("renvix_session=");
    expect(String(fetchImpl.mock.calls[1][0])).toBe(signedUrl);
    expect(fetchImpl.mock.calls[1][1]).toMatchObject({ method: "PUT", redirect: "manual" });
    expect(String(fetchImpl.mock.calls[2][0])).toBe(`https://api.renvix.app/api/ai/attachments/${attachmentId}/complete`);
  });

  it("rejects cross-site requests and sends an unrecognized signed URL only to the fixed backend fallback", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.renvix.app";
    const fetchImpl = vi.fn();
    const crossSite = await relaySignedAttachmentUpload(
      uploadRequest({ origin: "https://evil.example" }),
      { params: Promise.resolve({ attachmentId }) },
      fetchImpl
    );
    expect(crossSite.status).toBe(403);
    expect(fetchImpl).not.toHaveBeenCalled();

    fetchImpl.mockResolvedValueOnce(Response.json({ ok: true, attachment: { id: attachmentId, status: "ready" } }));
    const invalidUrl = await relaySignedAttachmentUpload(
      uploadRequest({ url: `https://evil.example/${attachmentId}.webm?X-Amz-Signature=x&X-Amz-Credential=x&X-Amz-Expires=300` }),
      { params: Promise.resolve({ attachmentId }) },
      fetchImpl
    );
    expect(invalidUrl.status).toBe(200);
    await expect(invalidUrl.json()).resolves.toMatchObject({ attachment: { id: attachmentId, status: "ready" } });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(fetchImpl.mock.calls[0][0])).toBe(`https://api.renvix.app/api/ai/attachments/${attachmentId}/upload`);
    expect(String(fetchImpl.mock.calls[0][0])).not.toContain("evil.example");
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ method: "PUT", redirect: "manual" });
  });

  it("does not contact R2 when ownership fails or the declared body exceeds the relay limit", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.renvix.app";
    const ownershipFetch = vi.fn(async () => Response.json({ ok: false, code: "ATTACHMENT_NOT_FOUND" }, { status: 404 }));
    const forbidden = await relaySignedAttachmentUpload(
      uploadRequest(),
      { params: Promise.resolve({ attachmentId }) },
      ownershipFetch
    );
    expect(forbidden.status).toBe(404);
    expect(ownershipFetch).toHaveBeenCalledTimes(1);

    const oversizedFetch = vi.fn();
    const oversized = await relaySignedAttachmentUpload(
      uploadRequest({ size: 4 * 1024 * 1024 + 1 }),
      { params: Promise.resolve({ attachmentId }) },
      oversizedFetch
    );
    expect(oversized.status).toBe(413);
    expect(oversizedFetch).not.toHaveBeenCalled();
  });
});
