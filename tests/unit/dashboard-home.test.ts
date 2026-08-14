import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const appSource = fs.readFileSync(path.resolve(process.cwd(), "src/app/app.js"), "utf8");

describe("dashboard home refresh stability", () => {
  it("does not show the empty-account onboarding panel while overview data is loading", () => {
    expect(appSource).toContain("const overviewReady = state.dashboardOverview !== null && !state.dashboardOverview?.error;");
    expect(appSource).toContain("const showWelcome = overviewReady && !hasBusinessData;");
  });

  it("batches dashboard data requests into one final render", () => {
    expect(appSource).toContain('const isAIPage = state.route === "/dashboard/support/ai"');
    expect(appSource).toContain("const batchesInitialRender = isDashboardHome");
    expect(appSource).toContain("renderOnComplete: !batchesInitialRender && !isAIPage");
    expect(appSource).toContain("const settled = Promise.allSettled(pending)");
    expect(appSource).toContain("void settled.then(() => {");
    expect(appSource).toContain("if (state.route !== routeAtStart) return;");
    expect(appSource).toContain("render();");
  });
});
