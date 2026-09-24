import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const appSource = fs.readFileSync(path.join(root, "src/app/app.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "src/styles/globals.css"), "utf8");
const route = fs.readFileSync(path.join(root, "app/api/ai/email-template/generate/route.js"), "utf8");

describe("renewal email AI editor contract", () => {
  it("exposes the required AI UX without provider or secret details", () => {
    expect(appSource).toContain("توليد قالب برمجي (HTML)");
    expect(appSource).toContain("ولّد كودًا آمنًا بالذكاء الاصطناعي، راجعه ثم اعتمده.");
    expect(appSource).toContain("إنشاء جديد");
    expect(appSource).toContain("تعديل الكود الحالي");
    expect(appSource).toContain('class="email-ai-optional">اختياري</b>');
    expect(appSource).not.toContain("اعتماد التصميم <small>اختياري</small>");
    expect(appSource).not.toMatch(/رصيد[^\n]{0,80}(DeepSeek|provider|دولار|تكلفة)/i);
  });

  it("keeps AI and applied-code previews sandboxed", () => {
    expect(appSource.match(/sandbox=""/g)?.length).toBeGreaterThanOrEqual(3);
    expect(appSource).toContain('referrerpolicy="no-referrer"');
  });

  it("stacks tools in the requested mobile order while keeping an iPad two-column grid", () => {
    expect(styles).toContain('grid-template-areas: "ai variables" "colors image"');
    expect(styles).toContain('grid-template-areas: "variables" "ai" "colors" "image"');
    expect(styles).toMatch(/@media \(max-width: 1120px\)[\s\S]*renewal-email-utility-grid[^}]*repeat\(2/);
  });

  it("uses the authenticated same-origin server endpoint and never calls DeepSeek from the browser", () => {
    expect(appSource).toContain('/backend/ai/email-template/generate');
    expect(appSource).not.toContain('api.deepseek.com');
    expect(route).toContain("requireSession");
    expect(route).toContain("sameOriginRequest");
  });
});
