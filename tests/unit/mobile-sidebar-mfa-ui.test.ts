import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const appSource = fs.readFileSync(path.join(root, "src/app/app.js"), "utf8");
const stylesSource = fs.readFileSync(path.join(root, "src/styles/globals.css"), "utf8");
const setupRoute = fs.readFileSync(path.join(root, "app/api/settings/security/mfa/setup/route.js"), "utf8");

describe("mobile sidebar and MFA UI contracts", () => {
  it("closes the mobile sidebar through a real outside backdrop", () => {
    expect(appSource).toContain('class="sidebar-backdrop" data-action="close-sidebar"');
    expect(appSource).toContain('action === "close-sidebar"');
    expect(stylesSource).toContain(".sidebar-backdrop");
    expect(stylesSource).toContain("z-index: 44");
  });

  it("keeps the MFA switch tied to persisted server state", () => {
    expect(appSource).toContain("const enabled = Boolean(state.accountSettings?.settings?.mfaEnabled)");
    expect(appSource).toContain("target.checked = enabled");
    expect(appSource).toContain("state.mfaSetupPending = true");
    expect(appSource).toContain('method: "DELETE"');
    expect(setupRoute).toContain("mfa_pending_secret_encrypted = NULL");
    expect(setupRoute).toContain("AND mfa_enabled = false");
  });

  it("includes a dedicated server-backed MFA login step", () => {
    expect(appSource).toContain('"/auth/verify-mfa": mfaLoginPage');
    expect(appSource).toContain('fetch("/api/auth/mfa/verify"');
    expect(appSource).toContain("payload?.requiresMfa === true");
  });
});
