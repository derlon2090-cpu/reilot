import { spawn } from "node:child_process";
import process from "node:process";

const host = "127.0.0.1";
const port = process.env.E2E_PORT || "3100";
const baseUrl = process.env.E2E_BASE_URL || `http://${host}:${port}`;
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 120000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      await wait(1000);
    }
  }

  throw new Error(`Timed out waiting for ${url}`);
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: "inherit", shell: false, ...options });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

async function stopProcessTree(child) {
  if (!child || child.killed) return;

  if (process.platform === "win32") {
    await run("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }

  child.kill("SIGTERM");
}

let server;

try {
  if (!process.env.E2E_BASE_URL) {
    const buildCode = await run(npmCommand, ["run", "build"], {
      env: {
        ...process.env,
        E2E_UI_PREVIEW: "1",
        NODE_OPTIONS: `${process.env.NODE_OPTIONS || ""} --max-old-space-size=4096`.trim()
      }
    });
    if (buildCode !== 0) throw new Error("The production build failed before E2E tests.");
    server = spawn(npmCommand, ["run", "start", "--", "-H", host, "-p", port], {
      stdio: "ignore",
      shell: false,
      env: { ...process.env, E2E_UI_PREVIEW: "1" }
    });
    await waitForServer(baseUrl);
  }

  const code = await run(npxCommand, ["playwright", "test", "--config=playwright.config.ts"], {
    env: { ...process.env, E2E_BASE_URL: baseUrl }
  });
  await stopProcessTree(server);
  process.exit(code);
} catch (error) {
  await stopProcessTree(server);
  console.error(error);
  process.exit(1);
}
