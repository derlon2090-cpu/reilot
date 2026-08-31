import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { proxyAIBackendRequest } from "../../app/backend/ai/[...path]/route.js";

const originalApiOrigin = process.env.NEXT_PUBLIC_API_BASE_URL;

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.renvix.app";
});

afterEach(() => {
  if (originalApiOrigin === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
  else process.env.NEXT_PUBLIC_API_BASE_URL = originalApiOrigin;
});

describe("AI frontend gateway", () => {
  it("validates the public origin then proxies cookies and streaming responses without forwarding Origin", async () => {
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
    const fetchImpl = vi.fn(async () => { throw new Error("secret detail"); });
    const response = await proxyAIBackendRequest(request, { params: Promise.resolve({ path: ["overview"] }) }, fetchImpl, {
      retryDelays: [0, 0], sleepImpl: async () => {}
    });
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).not.toContain("secret detail");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("retries transient read failures and returns the recovered response", async () => {
    const request = new Request("https://renvix.app/backend/ai/conversations?limit=100", {
      headers: { Origin: "https://renvix.app", "Sec-Fetch-Site": "same-origin" }
    });
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(Response.json({ ok: true, items: [{ id: "chat-1" }] }));
    const response = await proxyAIBackendRequest(request, { params: Promise.resolve({ path: ["conversations"] }) }, fetchImpl, {
      retryDelays: [0, 0], sleepImpl: async () => {}
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ items: [{ id: "chat-1" }] });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("never retries a mutating request", async () => {
    const request = new Request("https://renvix.app/backend/ai/messages", {
      method: "POST",
      headers: { Origin: "https://renvix.app", "Sec-Fetch-Site": "same-origin" },
      body: "{}"
    });
    const fetchImpl = vi.fn(async () => { throw new Error("temporary"); });
    const response = await proxyAIBackendRequest(request, { params: Promise.resolve({ path: ["messages"] }) }, fetchImpl, {
      retryDelays: [0, 0], sleepImpl: async () => {}
    });
    expect(response.status).toBe(503);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("aborts a stalled read attempt instead of leaving the browser pending indefinitely", async () => {
    const request = new Request("https://renvix.app/backend/ai/usage", {
      headers: { Origin: "https://renvix.app", "Sec-Fetch-Site": "same-origin" }
    });
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })), { once: true });
    }));

    const response = await proxyAIBackendRequest(request, { params: Promise.resolve({ path: ["usage"] }) }, fetchImpl, {
      retryDelays: [0], attemptTimeoutMs: 10, sleepImpl: async () => {}
    });

    expect(response.status).toBe(503);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("keeps the read deadline active while a JSON response body is stalled", async () => {
    const request = new Request("https://renvix.app/backend/ai/usage", {
      headers: { Origin: "https://renvix.app", "Sec-Fetch-Site": "same-origin" }
    });
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => new Response(new ReadableStream({
      start(controller) {
        init?.signal?.addEventListener("abort", () => controller.error(Object.assign(new Error("aborted"), { name: "AbortError" })), { once: true });
      }
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const response = await proxyAIBackendRequest(request, { params: Promise.resolve({ path: ["usage"] }) }, fetchImpl, {
      retryDelays: [0], attemptTimeoutMs: 10, sleepImpl: async () => {}
    });

    expect(response.status).toBe(503);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("rejects a successful HTML holding page instead of exposing it as AI JSON", async () => {
    const request = new Request("https://renvix.app/backend/ai/conversations", {
      headers: { Origin: "https://renvix.app", "Sec-Fetch-Site": "same-origin" }
    });
    const fetchImpl = vi.fn(async () => new Response("<!doctype html><title>RenewPilot AI</title>", {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" }
    }));

    const response = await proxyAIBackendRequest(request, { params: Promise.resolve({ path: ["conversations"] }) }, fetchImpl);
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(payload).toMatchObject({ ok: false, code: "AI_BACKEND_INVALID_RESPONSE" });
  });

  it("rejects malformed successful JSON without a protocol status", async () => {
    const request = new Request("https://renvix.app/backend/ai/storage", {
      headers: { Origin: "https://renvix.app", "Sec-Fetch-Site": "same-origin" }
    });
    const fetchImpl = vi.fn(async () => Response.json({ storage: null }, { status: 200 }));

    const response = await proxyAIBackendRequest(request, { params: Promise.resolve({ path: ["storage"] }) }, fetchImpl);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ code: "AI_BACKEND_INVALID_RESPONSE" });
  });
});
