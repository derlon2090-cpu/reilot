import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "../../app/api/admin/setup/status/route.js";
import { getAdminSetupState, issueAdminSetupAccessToken, resetAdminSetupRateLimitForTests } from "../../src/server/admin-setup.js";

describe("GET /api/admin/setup/status", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalSetupToken = process.env.ADMIN_SETUP_TOKEN;
  const originalLocalSetup = process.env.ADMIN_SETUP_ALLOW_LOCALHOST;

  beforeEach(() => {
    process.env.ADMIN_SETUP_TOKEN = "setup-token-with-more-than-32-characters-123";
    delete process.env.ADMIN_SETUP_ALLOW_LOCALHOST;
    delete process.env.DATABASE_URL;
    resetAdminSetupRateLimitForTests();
  });

  afterEach(() => {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
    if (originalSetupToken === undefined) delete process.env.ADMIN_SETUP_TOKEN;
    else process.env.ADMIN_SETUP_TOKEN = originalSetupToken;
    if (originalLocalSetup === undefined) delete process.env.ADMIN_SETUP_ALLOW_LOCALHOST;
    else process.env.ADMIN_SETUP_ALLOW_LOCALHOST = originalLocalSetup;
  });

  it("rejects a missing or incorrect setup token without querying the database", async () => {
    const missing = await GET(new Request("http://localhost/api/admin/setup/status"));
    const wrong = await GET(new Request("http://localhost/api/admin/setup/status?token=wrong"));
    expect(missing.status).toBe(404);
    expect(wrong.status).toBe(404);
    expect((await missing.json()).reason).toBe("invalid_setup_link");
  });

  it("returns the required message when DATABASE_URL is unavailable", async () => {
    const response = await GET(new Request(`http://localhost/api/admin/setup/status?token=${process.env.ADMIN_SETUP_TOKEN}`));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      reason: "database_unavailable",
      message: "تعذر الاتصال بقاعدة البيانات، تحقق من إعداد DATABASE_URL"
    });
  });

  it("accepts the short-lived HttpOnly setup session after validating the full link", async () => {
    const accessCookie = `renvix_admin_setup_access=${encodeURIComponent(issueAdminSetupAccessToken())}`;
    const resumed = await GET(new Request("http://localhost/api/admin/setup/status", {
      headers: { cookie: accessCookie }
    }));
    expect(resumed.status).toBe(503);
    expect((await resumed.json()).reason).toBe("database_unavailable");
  });

  it("allows the explicitly enabled local bootstrap URL without exposing the token", async () => {
    process.env.ADMIN_SETUP_ALLOW_LOCALHOST = "true";
    const local = await GET(new Request("http://127.0.0.1:3002/api/admin/setup/status"));
    expect(local.status).toBe(503);
    expect((await local.json()).reason).toBe("database_unavailable");

    const external = await GET(new Request("https://renvix.app/api/admin/setup/status"));
    expect(external.status).toBe(404);
  });

  it("reports that setup is permanently closed after an admin exists", async () => {
    await expect(getAdminSetupState(async () => ({ rows: [{ count: 1 }] }))).resolves.toEqual({ configured: true });
  });
});
