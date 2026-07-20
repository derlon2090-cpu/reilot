import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { changePasswordSchema, profileSettingsSchema } from "../../src/server/settings-profile.js";

const root = process.cwd();
const appSource = fs.readFileSync(path.join(root, "src/app/app.js"), "utf8");

describe("settings and admin UI contracts", () => {
  it("does not rerender the subscription window from the click handler", () => {
    const actionHandler = appSource.slice(appSource.indexOf("async function handleAction"), appSource.indexOf("async function handleSubmit"));
    expect(actionHandler).not.toContain('action === "subscription-window"');
    expect(appSource).toContain('target.dataset.action === "subscription-window"');
  });

  it("keeps settings cards in account, security, interface, notifications order", () => {
    const start = appSource.indexOf("function settingsPage");
    const end = appSource.indexOf("function settingToggle", start);
    const section = appSource.slice(start, end);
    const positions = ["settings-account-card", "settings-security-card", "settings-interface-card", "settings-notifications-card"].map((value) => section.indexOf(value));
    expect(positions.every((value) => value >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it("validates profile and password payloads server-side", () => {
    expect(profileSettingsSchema.safeParse({ fullName: "أحمد العتيبي", storeName: "متجر أحمد", phone: "+966501234567" }).success).toBe(true);
    expect(profileSettingsSchema.safeParse({ fullName: "أ", phone: "0551234567" }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ currentPassword: "OldPassword1", newPassword: "NewPassword2", confirmPassword: "NewPassword2" }).success).toBe(true);
    expect(changePasswordSchema.safeParse({ currentPassword: "samePassword1", newPassword: "samePassword1", confirmPassword: "different" }).success).toBe(false);
  });

  it("promotes only an existing user and never creates credentials", () => {
    const script = fs.readFileSync(path.join(root, "scripts/promote-admin.mjs"), "utf8");
    expect(script).toContain("No existing Renvix user was found");
    expect(script).not.toMatch(/INSERT INTO users/i);
    expect(script).not.toMatch(/INSERT INTO accounts/i);
    expect(script).not.toContain("ADMIN_BOOTSTRAP_PASSWORD");
  });
});

