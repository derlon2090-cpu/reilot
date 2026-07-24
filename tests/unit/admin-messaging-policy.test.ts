import { describe, expect, it } from "vitest";
import { assertProviderAllowed, renderAdminTemplate, validateAdminTemplate } from "../../src/server/admin-messaging.js";

describe("admin messaging provider isolation", () => {
  it("keeps Evolution in the platform scope and Meta in the tenant scope", () => {
    expect(assertProviderAllowed({ scope: "platform_admin", provider: "evolution" })).toBe(true);
    expect(assertProviderAllowed({ scope: "tenant", provider: "meta_cloud_api" })).toBe(true);
    expect(() => assertProviderAllowed({ scope: "platform_admin", provider: "meta_cloud_api" })).toThrow("ADMIN_PROVIDER_NOT_ALLOWED");
    expect(() => assertProviderAllowed({ scope: "tenant", provider: "evolution" })).toThrow("TENANT_PROVIDER_NOT_ALLOWED");
  });

  it("rejects unknown variables and uses one renderer for previews", () => {
    expect(validateAdminTemplate({ body: "مرحبًا {{secret}}", allowedVariables: ["customer_name"], requiredVariables: [] })).toMatchObject({ ok: false, code: "VARIABLE_NOT_ALLOWED" });
    const rendered = renderAdminTemplate({ body: "مرحبًا {{customer_name}} {{temporary_password}}", allowedVariables: ["customer_name","temporary_password"], requiredVariables: ["customer_name"] }, { customer_name: "وليد", temporary_password: "RealPassword" }, { maskTemporaryPassword: true });
    expect(rendered.body).toBe("مرحبًا وليد ••••••••••••");
    expect(rendered.body).not.toContain("RealPassword");
  });
});
