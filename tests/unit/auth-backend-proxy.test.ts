import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  authBackendWarmingResponse,
  proxyAuthBackendRequest,
  resetAuthBackendReadinessForTests
} from "../../src/shared/auth-backend-proxy.js";

describe("stable authentication backend gateway", () => {
  beforeEach(() => resetAuthBackendReadinessForTests());

  it("warms Render before forwarding an authentication request", async () => {
    const fetcher = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname === "/api/auth/readiness") {
        return Response.json({ ok: true, service: "renvix-auth" });
      }
      expect(init?.headers instanceof Headers ? init.headers.get("x-renvix-auth-gateway") : null).toBe("accounts");
      return Response.json({ ok: true, clientId: "web-client.apps.googleusercontent.com" });
    });

    const response = await proxyAuthBackendRequest(
      new Request("https://accounts.renvix.app/api/auth/google/config", { headers: { Accept: "application/json" } }),
      "https://api.renvix.app",
      { fetcher }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(new URL(String(fetcher.mock.calls[0][0])).hostname).toBe("api.renvix.app");
    expect(new URL(String(fetcher.mock.calls[1][0])).pathname).toBe("/api/auth/google/config");
  });

  it("stays available while Render is still on the previous deployment", async () => {
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      const url = new URL(String(input));
      if (url.pathname === "/api/auth/readiness") {
        return new Response("<html>old catch-all page</html>", { headers: { "Content-Type": "text/html" } });
      }
      if (url.pathname === "/api/auth/google/config") {
        return Response.json({ ok: true, clientId: "web-client.apps.googleusercontent.com" });
      }
      return Response.json({ ok: true });
    });

    const response = await proxyAuthBackendRequest(
      new Request("https://accounts.renvix.app/api/auth/session", { headers: { Accept: "application/json" } }),
      "https://api.renvix.app",
      { fetcher }
    );

    expect(response.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(new URL(String(fetcher.mock.calls[1][0])).pathname).toBe("/api/auth/google/config");
  });

  it("forwards redirects and every shared-domain authentication cookie", async () => {
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      if (new URL(String(input)).pathname === "/api/auth/readiness") {
        return Response.json({ ok: true, service: "renvix-auth" });
      }
      const headers = new Headers({ Location: "https://accounts.google.com/o/oauth2/v2/auth?state=safe" });
      headers.append("Set-Cookie", "renvix_google_oauth_state=one; Path=/api/auth/google; Domain=.renvix.app; HttpOnly");
      headers.append("Set-Cookie", "renvix_google_oauth_verifier=two; Path=/api/auth/google; Domain=.renvix.app; HttpOnly");
      return new Response(null, { status: 302, headers });
    });

    const response = await proxyAuthBackendRequest(
      new Request("https://accounts.renvix.app/api/auth/google/start?intent=register", { headers: { Accept: "text/html" } }),
      "https://api.renvix.app",
      { fetcher }
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("accounts.google.com");
    expect(response.headers.get("set-cookie")).toContain("renvix_google_oauth_state=one");
    expect(response.headers.get("set-cookie")).toContain("renvix_google_oauth_verifier=two");
    expect(response.headers.get("x-renvix-auth-gateway")).toBe("accounts");
  });

  it("never exposes Render's holding page to a browser navigation", async () => {
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      if (new URL(String(input)).pathname === "/api/auth/readiness") {
        return Response.json({ ok: true, service: "renvix-auth" });
      }
      return new Response("<html>Render — SERVICE WAKING UP — ALLOCATING COMPUTE RESOURCES</html>", {
        status: 503,
        headers: { "Content-Type": "text/html" }
      });
    });

    const response = await proxyAuthBackendRequest(
      new Request("https://accounts.renvix.app/api/auth/session/continue?returnTo=%2Fdashboard", {
        headers: { Accept: "text/html", "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Dest": "document" }
      }),
      "https://api.renvix.app",
      { fetcher }
    );
    const html = await response.text();

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("3");
    expect(response.headers.get("x-renvix-auth-gateway")).toBe("warming");
    expect(html).toContain("جاري تجهيز تسجيل الدخول الآمن");
    expect(html).not.toMatch(/service waking up|allocating compute resources/i);
  });

  it("returns a machine-readable warming response to fetch clients", async () => {
    const response = authBackendWarmingResponse(new Request("https://accounts.renvix.app/api/auth/google/config", {
      headers: { Accept: "application/json" }
    }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, reason: "auth_backend_warming", retryAfter: 3 });
  });
});
