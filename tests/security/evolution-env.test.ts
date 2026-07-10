import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("Evolution self-hosted environment security", () => {
  it("declares the required self-hosted environment variables once", () => {
    const envExample = readFileSync(".env.example", "utf8");

    expect(envExample).toContain("WHATSAPP_PROVIDER=evolution");
    expect(envExample).toContain("EVOLUTION_API_URL=");
    expect(envExample).toContain("EVOLUTION_API_KEY=");
    expect(envExample).toContain("EVOLUTION_WEBHOOK_SECRET=");
    expect(envExample.match(/^WHATSAPP_PROVIDER=/gm)).toHaveLength(1);
  });

  it("does not expose the configured Evolution API secret value in frontend assets", () => {
    const frontend = readFileSync("src/app/app.js", "utf8") + readFileSync("src/styles/globals.css", "utf8");

    expect(frontend).not.toContain("server-key");
    expect(frontend).not.toContain("plain-instance-token");
  });
});
