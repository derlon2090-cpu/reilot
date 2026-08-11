import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appStyles = readFileSync("src/styles/globals.css", "utf8");
const adminStyles = readFileSync("src/components/admin/AdminPortal.module.css", "utf8");

const stickyAppPreviews = {
  "email-preview-side": 92,
  "meta-approved-preview": 88,
  "email-preview-v2": 88,
  "salla-live-preview": 96,
  "salla-template-preview-sticky": 92,
  "campaign-preview-card": 82,
  "campaign-studio-preview": 82
};

const stickyAdminPreviews = {
  adminNotificationPreview: 92,
  adminTemplatePreviewCard: 18,
  adminSupportPreview: 88,
  adminCampaignPreview: 20
};

function declarationsFor(source: string, className: string) {
  const matches = [...source.matchAll(new RegExp(`\\.${className}[^,{]*\\{([^}]*)\\}`, "g"))];
  expect(matches.length, `Missing .${className} declaration`).toBeGreaterThan(0);
  return matches.map((match) => match[1] || "");
}

describe("anchored preview layout", () => {
  it.each(Object.entries(stickyAppPreviews))("keeps .%s visible at its professional offset", (className, top) => {
    const declarations = declarationsFor(appStyles, className);
    expect(declarations.some((declaration) => /position\s*:\s*sticky/.test(declaration))).toBe(true);
    expect(declarations.some((declaration) => new RegExp(`top\\s*:\\s*${top}px`).test(declaration))).toBe(true);
  });

  it.each(Object.entries(stickyAdminPreviews))("keeps admin .%s visible at its professional offset", (className, top) => {
    const declarations = declarationsFor(adminStyles, className);
    expect(declarations.some((declaration) => /position\s*:\s*sticky/.test(declaration))).toBe(true);
    expect(declarations.some((declaration) => new RegExp(`top\\s*:\\s*${top}px`).test(declaration))).toBe(true);
  });

  it("does not animate preview viewport changes", () => {
    expect(declarationsFor(appStyles, "order-preview-slide").join("\n")).toMatch(/transition\s*:\s*none/);
    expect(declarationsFor(appStyles, "campaign-studio-email-preview").join("\n")).toMatch(/transition\s*:\s*none/);
  });
});
