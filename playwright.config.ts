import { defineConfig, devices } from "@playwright/test";
import os from "node:os";
import path from "node:path";

const outputDir = process.env.PLAYWRIGHT_OUTPUT_DIR
  || path.join(os.tmpdir(), "renvix-salla-stage-playwright");
const browserChannel = process.env.PLAYWRIGHT_CHANNEL;

export default defineConfig({
  testDir: "tests/e2e",
  testIgnore: "**/*.live.spec.ts",
  outputDir,
  workers: 1,
  timeout: 30000,
  expect: { timeout: 5000 },
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    ...(browserChannel ? { channel: browserChannel } : {})
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } }
  ]
});
