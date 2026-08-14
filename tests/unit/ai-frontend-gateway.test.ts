import { afterEach, describe, expect, it, vi } from "vitest";
import { proxyAIBackendRequest } from "../../app/backend/ai/[...path]/route.js";

const originalApiOrigin = process.env.NEXT_PUBLIC_API_BASE_URL;

afterEach(() => {
  if (originalApiOrigin === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
  else process.env.NEXT_PUBLIC_API_BASE_URL = originalApiOrigin;
});

describe("AI frontend gateway", () => {
  it("validates the public origin then proxies cookies and streaming responses without forwarding Origin", async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.renvix.app";
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response("event: done\ndata: {}\n\n", {
      status: 200,
      headers: { "Content-Type": "text/event-stream", "Content-Length": "24" }
    }));
    const request = new Request("https://renvix.app/backend/ai/conversations/chat-1/messages?mode=live", {
      method: "POST",
      headers: {
        Origin: "https://renvix.app",
        "Sec-Fetch-Site": "same-origin",
        "Content-Type": "application/json",
        Cookie: "renvix_session=test-session"
      },
      body: JSON.stringify({ prompt: "اختبار" })
    });

    const response = await proxyAIBackendRequest(request, { params: Promise.resolve({ path: ["conversations", "chat-1", "messages"] }) }, fetchImpl);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(response.headers.get("content-length")).toBeNull();
    expect(await response.text()).toContain("event: done");
    const [target, options] = fetchImpl.mock.calls[0];
    const forwardedHeaders = new Headers(options?.headers);
    expect(String(target)).toBe("https://api.renvix.app/api/ai/conversations/chat-1/messages?mode=live");
    expect(forwardedHeaders.get("cookie")).toContain("renvix_session=");
    expect(forwardedHeaders.get("origin")).toBeNull();
    expect(forwardedHeaders.get("x-renvix-frontend-gateway")).toBe("ai");
  });

  it("rejects cross-site requests before contacting Render", async () => {
    const fetchImpl = vi.fn();
    const request = new Request("https://renvix.app/backend/ai/messages", {
      method: "POST",
      headers: { Origin: "https://attacker.example", "Sec-Fetch-Site": "cross-site" },
      body: "{}"
    });
    const response = await proxyAIBackendRequest(request, { params: Promise.resolve({ path: ["messages"] }) }, fetchImpl);
    expect(response.status).toBe(403);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns a no-store 503 without exposing backend errors", async () => {
    const request = new Request("https://renvix.app/backend/ai/overview", {
      headers: { Origin: "https://renvix.app", "Sec-Fetch-Site": "same-origin" }
    });
    const response = await proxyAIBackendRequest(request, { params: Promise.resolve({ path: ["overview"] }) }, vi.fn(async () => { throw new Error("secret detail"); }));
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).not.toContain("secret detail");
  });
});
