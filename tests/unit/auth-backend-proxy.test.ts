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
      expect(init?.headers instanceof Headers ? init.headers.get("cf-access-jwt-assertion") : null).toBeNull();
      return Response.json({ ok: true });
    });

    const response = await proxyAuthBackendRequest(
      new Request("https://accounts.renvix.app/api/auth/login", {
        headers: { Accept: "application/json", "Cf-Access-Jwt-Assertion": "must-not-reach-render" }
      }),
      "https://api.renvix.app",
      { fetcher }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(new URL(String(fetcher.mock.calls[0][0])).hostname).toBe("api.renvix.app");
    expect(new URL(String(fetcher.mock.calls[1][0])).pathname).toBe("/api/auth/login");
  });

  it("forwards redirects and every shared-domain authentication cookie", async () => {
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      if (new URL(String(input)).pathname === "/api/auth/readiness") {
        return Response.json({ ok: true, service: "renvix-auth" });
      }
      const headers = new Headers({ Location: "https://dash.renvix.app/dashboard" });
      headers.append("Set-Cookie", "renewpilot_session=one; Path=/; Domain=.renvix.app; HttpOnly");
      headers.append("Set-Cookie", "renvix_trusted_browser=two; Path=/; Domain=.renvix.app; HttpOnly");
      return new Response(null, { status: 302, headers });
    });

    const response = await proxyAuthBackendRequest(
      new Request("https://accounts.renvix.app/api/auth/session/continue", { headers: { Accept: "text/html" } }),
      "https://api.renvix.app",
      { fetcher }
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("dash.renvix.app");
    expect(response.headers.get("set-cookie")).toContain("renewpilot_session=one");
    expect(response.headers.get("set-cookie")).toContain("renvix_trusted_browser=two");
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
    const response = authBackendWarmingResponse(new Request("https://accounts.renvix.app/api/auth/login", {
      headers: { Accept: "application/json" }
    }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, reason: "auth_backend_warming", retryAfter: 3 });
  });
});
