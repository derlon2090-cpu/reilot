import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appStyles = readFileSync("src/styles/globals.css", "utf8");
const adminStyles = readFileSync("src/components/admin/AdminPortal.module.css", "utf8");

const fixedAppPreviews = [
  "email-preview-side",
  "meta-approved-preview",
  "email-preview-v2",
  "salla-live-preview",
  "salla-template-live-preview",
  "campaign-preview-card",
  "campaign-studio-preview"
];

const fixedAdminPreviews = [
  "adminNotificationPreview",
  "adminTemplatePreviewCard",
  "adminSupportPreview",
  "adminCampaignPreview"
];

function declarationsFor(source: string, className: string) {
  const matches = [...source.matchAll(new RegExp(`\\.${className}[^,{]*\\{([^}]*)\\}`, "g"))];
  expect(matches.length, `Missing .${className} declaration`).toBeGreaterThan(0);
  return matches.map((match) => match[1] || "");
}

describe("stationary preview layout", () => {
  it.each(fixedAppPreviews)("keeps .%s in its layout position", (className) => {
    const declarations = declarationsFor(appStyles, className);
    expect(declarations.some((declaration) => /position\s*:\s*static/.test(declaration))).toBe(true);
    expect(declarations.join("\n")).not.toMatch(/position\s*:\s*sticky/);
  });

  it.each(fixedAdminPreviews)("keeps admin .%s in its layout position", (className) => {
    const declarations = declarationsFor(adminStyles, className);
    expect(declarations.some((declaration) => /position\s*:\s*static/.test(declaration))).toBe(true);
    expect(declarations.join("\n")).not.toMatch(/position\s*:\s*sticky/);
  });

  it("does not animate preview viewport changes", () => {
    expect(declarationsFor(appStyles, "order-preview-slide").join("\n")).toMatch(/transition\s*:\s*none/);
    expect(declarationsFor(appStyles, "campaign-studio-email-preview").join("\n")).toMatch(/transition\s*:\s*none/);
  });
});
