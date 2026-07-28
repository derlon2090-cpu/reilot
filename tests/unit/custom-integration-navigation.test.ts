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
});
