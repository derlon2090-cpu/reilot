import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.resolve(process.cwd(), "src/app/app.js"), "utf8");

describe("custom integration navigation", () => {
  it("opens the integration setup inside the authenticated dashboard", () => {
    expect(source).toContain(
      'data-link="/dashboard/settings/integrations/custom-api"'
    );
  });

  it("redirects legacy integration URLs to the dashboard route", () => {
    expect(source).toContain(
      '"/settings/integrations/custom-api": "/dashboard/settings/integrations/custom-api"'
    );
    expect(source).toContain(
      '"/dashboard/apps/custom-integration": "/dashboard/settings/integrations/custom-api"'
    );
  });

  it("keeps the first-integration setup on its own authenticated route", () => {
    expect(source).toContain('"/dashboard/settings/integrations/custom-api/setup"');
    expect(source).toContain("function customIntegrationSetupPage()");
    expect(source).toContain('data-submit="${item ? "custom-integration-update" : "custom-integration"}"');
    expect(source).toContain('data-action="open-custom-api-setup"');
    expect(source).toContain('if (action === "open-custom-api-setup")');
    expect(source).not.toContain('class="card custom-api-create"');
  });

  it("renders a complete empty dashboard without fabricated integrations", () => {
    expect(source).toContain("capi-overview-status");
    expect(source).toContain("لم يتم إنشاء مفتاح API بعد");
    expect(source).toContain("لم تتم إضافة Webhook بعد");
    expect(source).toContain("لا توجد تسليمات حتى الآن");
  });

  it("updates an existing Webhook and queues the promised test after saving", () => {
    expect(source).toContain('data-endpoint-id="${escapeHtml(webhook.id || "")}"');
    expect(source).toContain('method: endpointId ? "PATCH" : "POST"');
    expect(source).toContain('`${baseUrl}/${encodeURIComponent(savedEndpointId)}/test`');
    expect(source).toContain("تمت جدولة حدث اختبار حقيقي");
  });

  it("uses the real form values for setup preview and performs a read-only API-key test", () => {
    expect(source).toContain("معاينة إعداد التكامل");
    expect(source).toContain('data-action="test-custom-api-key"');
    expect(source).toContain('"/api/v1/customers?limit=1"');
    expect(source).toContain('"/api/v1/subscriptions?limit=1"');
    expect(source).toContain("fetch(testEndpoint");
    expect(source).toContain("نجح اختبار API");
  });

  it("keeps the one-time API key visible while the integration list refreshes", () => {
    expect(source).toContain("if (!payload.apiKey || !payload.item?.id)");
    expect(source).toContain("items: [createdItem, ...currentItems.filter");
    expect(source).toContain('target === "customIntegrations"');
    expect(source).toContain("const preservedItem = { ...(incomingItem || {}), ...optimisticItem, keys }");
    expect(source).toContain("keys: payload.key ? [payload.key] : []");
    expect(source).toContain('await navigate("/dashboard/settings/integrations/custom-api/key-created", { sessionVerified: true })');
    expect(source).toContain("void syncRouteData(true)");
  });

  it("shows and manages the created API keys from the integration dashboard", () => {
    expect(source).toContain("function customApiKeyManagement(item)");
    expect(source).toContain("انسخ المفتاح الحقيقي الآن");
    expect(source).toContain('data-action="revoke-custom-key"');
    expect(source).toContain('action === "confirm-revoke-custom-key"');
    expect(source).toContain("/keys/${encodeURIComponent(keyId)}");
    expect(source).toContain("استبدال المفتاح الحالي");
    expect(source).toContain("يسمح بتكامل API / Webhook واحد فقط");
  });
});
