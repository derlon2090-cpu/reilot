import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../../src/app/app.js", import.meta.url), "utf8");

describe("templates catalog UI", () => {
  it("replaces the legacy renewal-template navigation with the templates center", () => {
    expect(appSource).toContain('["/dashboard/templates", "القوالب", "template"]');
    expect(appSource).toContain('"/dashboard/renewal-template": "/dashboard/templates"');
  });

  it("builds catalog counts from persisted renewal templates only", () => {
    expect(appSource).toContain("function templateCatalogItems()");
    expect(appSource).toContain("state.notificationTemplate?.templates");
    expect(appSource).toContain('["renewal_whatsapp", "renewal_email"]');
    expect(appSource).not.toContain('...orderTemplates.map');
    expect(appSource).not.toContain("const sampleEmailValue");
  });

  it("supports the real channel filters required by the catalog", () => {
    expect(appSource).toContain('["all", "الكل"]');
    expect(appSource).toContain('["whatsapp", "واتساب"]');
    expect(appSource).toContain('["email", "بريد إلكتروني"]');
    expect(appSource).toContain('pageTitle("قوالب التجديد")');
  });
});
