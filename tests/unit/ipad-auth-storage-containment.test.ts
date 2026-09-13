import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync("src/app/app.js", "utf8");
const styles = readFileSync("src/styles/globals.css", "utf8");

describe("iPad auth and storage containment", () => {
  it("renders a complete, accessible two-step password recovery form", () => {
    expect(appSource).toContain('class="auth-recovery-progress"');
    expect(appSource).toContain('autocomplete="one-time-code"');
    expect(appSource).toContain('data-action="reset-change-email"');
    expect(appSource).toContain('class="auth-reset-email-context"');
    expect(appSource).toContain('autocomplete="new-password"');
  });

  it("keeps recovery scrollable inside short landscape iPad viewports", () => {
    expect(styles).toContain(".auth-suite-page .auth-suite-reset>.auth-suite-panel");
    expect(styles).toContain("@media (min-width:821px) and (max-height:760px)");
    expect(styles).toContain("overflow-y:auto!important");
  });

  it("lays out every storage toolbar control inside a bounded iPad grid", () => {
    expect(styles).toContain(':root[data-home-tablet-layout="true"] .storage-toolbar');
    expect(styles).toContain("grid-template-columns:minmax(180px,1.4fr) minmax(105px,.58fr) minmax(130px,.68fr) minmax(105px,.58fr) 82px");
    expect(styles).toContain(':root[data-home-tablet-layout="true"] .storage-toolbar :is(select,.storage-date-filter)');
  });
});
