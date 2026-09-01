import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf8"));

describe("Vercel Hobby cron compatibility", () => {
  it("does not schedule any project cron more frequently than once per day", () => {
    for (const cron of config.crons || []) {
      const fields = String(cron.schedule || "").trim().split(/\s+/);
      expect(fields, `${cron.path} must use a valid five-field cron expression`).toHaveLength(5);
      expect(fields[0], `${cron.path} must use one fixed minute`).toMatch(/^\d{1,2}$/);
      expect(fields[1], `${cron.path} must use one fixed hour`).toMatch(/^\d{1,2}$/);
    }
  });
});
