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

  it("keeps the first-integration form collapsed until the setup action is used", () => {
    expect(source).toContain('id="custom-api-create" class="card custom-api-create"');
    expect(source).toContain('data-action="open-custom-api-setup"');
    expect(source).toContain('if (action === "open-custom-api-setup")');
    expect(source).not.toContain('class="card custom-api-create" ${item ? "" : "open"}');
  });

  it("renders a complete empty dashboard without fabricated integrations", () => {
    expect(source).toContain('custom-api-summary custom-api-summary--empty');
    expect(source).toContain('لم يتم إنشاء مفتاح API بعد');
    expect(source).toContain('لم تتم إضافة عنوان Webhook بعد');
    expect(source).toContain('لا توجد تسليمات حتى الآن');
  });
});
