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
    expect(client).toContain("payload?.ok === true");
    expect(client).toContain("Boolean(payload.user?.id)");
    expect(page).toContain('if (isDashboard)');
    expect(page).toContain('if (!session) redirect("/login")');
  });

  it("does not seed the legacy temporary administrator", () => {
    const securityMigration = fs.readFileSync("drizzle/0020_dynamic_security_scores.sql", "utf8");
    const cleanupMigration = fs.readFileSync("drizzle/0029_remove_legacy_temporary_admin.sql", "utf8");

    expect(securityMigration).not.toContain("temporary.admin@renvix.app");
    expect(securityMigration).not.toContain("scrypt$");
    expect(cleanupMigration).toContain("DELETE FROM users");
    expect(cleanupMigration).toContain("temporary.admin@renvix.app");
  });
});
