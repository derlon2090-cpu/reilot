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

  it("preserves the user dashboard position when a sidebar section is selected", () => {
    expect(appSource).toContain("dashboardRouteScrollPositions: new Map()");
    expect(appSource).toContain('history.scrollRestoration = "manual"');
    expect(appSource).toContain("function captureDashboardScrollPosition");
    expect(appSource).toContain("function restoreDashboardSidebarScroll");
    expect(appSource).toContain("function restoreDashboardScrollPosition");
    expect(appSource).toContain('preserveScroll: Boolean(link.closest(".sidebar"))');
    expect(appSource).not.toContain('requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }))');
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

  it("contains storage timers, channel metrics, billing plans, and chat actions on iPad", () => {
    expect(tabletPolish).toContain("/* iPad content-density pass:");
    expect(tabletPolish).toContain(".storage-document-timer");
    expect(tabletPolish).toContain("grid-template-columns:14px minmax(0,1fr) auto");
    expect(tabletPolish).toContain(".ref-metrics .suite-metric");
    expect(tabletPolish).toContain(".dashboard-plan-grid");
    expect(tabletPolish).toContain(".rvx-ai-quick-actions");
  });

  it("keeps subscription metrics in one balanced iPad row", () => {
    expect(appSource).toContain('], "subscription-metrics")}');
    expect(tabletPolish).toContain(".subscription-metrics");
    expect(tabletPolish).toContain("grid-template-columns:repeat(4,minmax(0,1fr))!important");
    expect(tabletPolish).toContain("grid-template-columns:40px minmax(0,1fr)");
    expect(tabletPolish).toContain("-webkit-line-clamp:2");
  });

  it("ships the same tablet styles and cache version to both application entries", () => {
    expect(publicStyles).toContain(tabletPolish.trim());
    const versions = [rootLayout, staticIndex].flatMap((markup) =>
      [...markup.matchAll(/(?:globals\.css|app\.js)\?v=([^"']+)/g)].map((match) => match[1])
    );
    expect(versions.length).toBe(4);
    expect(new Set(versions)).toEqual(new Set(["20260911-brand-system-v150"]));
  });
});
