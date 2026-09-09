import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../../src/app/app.js", import.meta.url), "utf8");
const sourceStyles = readFileSync(new URL("../../src/styles/globals.css", import.meta.url), "utf8");
const publicStyles = readFileSync(new URL("../../public/app/styles/globals.css", import.meta.url), "utf8");
const rootLayout = readFileSync(new URL("../../app/layout.jsx", import.meta.url), "utf8");
const staticIndex = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

const navigationStart = appSource.indexOf("async function navigate(");
const navigationEnd = appSource.indexOf("async function enterDashboardAfterSessionVerification", navigationStart);
const navigationSource = appSource.slice(navigationStart, navigationEnd);
const tabletPolishStart = sourceStyles.indexOf("/* iPad dashboard metric rows:");
const tabletPolish = sourceStyles.slice(tabletPolishStart);

describe("iPad dashboard navigation and metric rows", () => {
  it("commits dashboard-to-dashboard navigation without waiting for the session request", () => {
    expect(navigationSource).toContain('const internalDashboardTransition = previousRoute.startsWith("/dashboard")');
    expect(navigationSource).toContain("!internalDashboardTransition && !await browserSessionIsValid()");
    expect(navigationSource).toContain("void revalidateDashboardSession()");
    expect(navigationSource).toContain('previousRoute === "/dashboard/storage"');
    expect(navigationSource).toContain("disposeStorageRoute()");
  });

  it("cancels stale storage work and prevents it from repainting another section", () => {
    expect(appSource).toContain("state.storageCenterRequestController = null");
    expect(appSource).toContain("function disposeStorageRoute()");
    expect(appSource).toContain("state.storageCenterRequestController?.abort()");
    expect(appSource).toContain('target === "storageCenter" && (storageRevisionAtStart !== state.storageCenterRevision || state.route !== "/dashboard/storage")');
    expect(appSource).toContain('target !== "storageCenter" || (state.route === "/dashboard/storage"');
  });

  it("keeps four, five, and six-card summaries in a single landscape iPad row", () => {
    expect(tabletPolishStart).toBeGreaterThan(-1);
    expect(tabletPolish).toContain('@media (min-width:901px) and (max-width:1700px)');
    expect(tabletPolish).toContain(".suite-metrics-four");
    expect(tabletPolish).toContain("grid-template-columns:repeat(4,minmax(0,1fr))!important");
    expect(tabletPolish).toContain(".suite-metrics-six");
    expect(tabletPolish).toContain("grid-template-columns:repeat(6,minmax(0,1fr))!important");
    expect(tabletPolish).toContain(".storage-stats");
    expect(tabletPolish).toContain("grid-template-columns:repeat(4,minmax(0,1fr)) minmax(220px,1.42fr)!important");
    expect(tabletPolish).toContain(".billing-stats-grid");
  });

  it("contains long labels and keeps portrait tablet cards on one scrollable row", () => {
    expect(tabletPolish).toContain("text-overflow:ellipsis");
    expect(tabletPolish).toContain("white-space:nowrap");
    expect(tabletPolish).toContain('@media (min-width:641px) and (max-width:900px)');
    expect(tabletPolish).toContain("display:flex!important");
    expect(tabletPolish).toContain("overflow-x:auto");
  });

  it("ships the same tablet styles and cache version to both application entries", () => {
    expect(publicStyles).toContain(tabletPolish.trim());
    const versions = [rootLayout, staticIndex].flatMap((markup) =>
      [...markup.matchAll(/(?:globals\.css|app\.js)\?v=([^"']+)/g)].map((match) => match[1])
    );
    expect(versions.length).toBe(4);
    expect(new Set(versions)).toEqual(new Set(["20260909-ipad-dashboard-polish-v146"]));
  });
});
