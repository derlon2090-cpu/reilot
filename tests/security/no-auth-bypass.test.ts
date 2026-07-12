import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("authentication boundary source", () => {
  it("contains no preview or local authentication bypass", () => {
    const page = fs.readFileSync("app/[[...slug]]/page.jsx", "utf8");
    const client = fs.readFileSync("src/app/app.js", "utf8");
    const runner = fs.readFileSync("tests/e2e/run-e2e.mjs", "utf8");
    const combined = `${page}\n${client}\n${runner}`;

    expect(combined).not.toMatch(/E2E_UI_PREVIEW|authenticatedSession|localDemoLogin|skipPassword|allowLogin/);
    expect(client).not.toContain('storage.set("renewpilot.account"');
    expect(client).not.toContain('storage.get("renewpilot.linkedDevice"');
    expect(page).toContain('if (isDashboard)');
    expect(page).toContain('if (!session) redirect("/login")');
  });
});
