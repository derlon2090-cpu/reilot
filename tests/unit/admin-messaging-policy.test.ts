import { describe, expect, it } from "vitest";
import { assertProviderAllowed, renderAdminTemplate, validateAdminTemplate } from "../../src/server/admin-messaging.js";
import { ADMIN_TEMPLATE_KEYS, EVENT_TEMPLATE_MAP } from "../../src/server/admin-template-events.js";

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

  it("maps each immutable system template to exactly one committed domain event", () => {
    expect(ADMIN_TEMPLATE_KEYS).toEqual({
      ACCOUNT_CREATED: "admin_account_created",
      SUBSCRIPTION_RENEWED: "admin_subscription_renewed",
      NUMBER_DISCONNECTED: "admin_number_disconnected",
      SALLA_INSTALLED: "admin_salla_installed"
    });
    expect(EVENT_TEMPLATE_MAP).toEqual({
      "account.provisioned": "admin_account_created",
      "subscription.renewed": "admin_subscription_renewed",
      "channel.disconnected": "admin_number_disconnected",
      "salla.integration.ready": "admin_salla_installed"
    });
    expect(new Set(Object.values(EVENT_TEMPLATE_MAP)).size).toBe(4);
  });

  it("refuses an active send when a required value is missing", () => {
    expect(() => renderAdminTemplate(
      {
        subject: "تم التجديد",
        body: "مرحبًا {{customer_name}}، ينتهي اشتراكك في {{new_expiry}}",
        allowedVariables: ["customer_name", "new_expiry"],
        requiredVariables: ["customer_name", "new_expiry"]
      },
      { customer_name: "عميل حقيقي" }
    )).toThrow("REQUIRED_VALUE_MISSING");
  });
});
