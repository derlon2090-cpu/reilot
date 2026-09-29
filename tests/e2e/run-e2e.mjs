import { spawn } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

const host = "127.0.0.1";
const port = process.env.E2E_PORT || "3100";
const baseUrl = process.env.E2E_BASE_URL || `http://${host}:${port}`;
const npmCli = process.env.npm_execpath;
const playwrightCli = fileURLToPath(new URL("../../node_modules/@playwright/test/cli.js", import.meta.url));
const runtimeEnv = {
  ...process.env,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || "https://renvix.app",
  NEXT_PUBLIC_AUTH_URL: process.env.NEXT_PUBLIC_AUTH_URL || "https://accounts.renvix.app",
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "https://dash.renvix.app",
  NEXT_PUBLIC_ADMIN_URL: process.env.NEXT_PUBLIC_ADMIN_URL || "https://wa-admin.renvix.app",
  NEXT_PUBLIC_AUTH_API_URL: process.env.NEXT_PUBLIC_AUTH_API_URL || "https://api.renvix.app"
};
const localServerOrigin = "https://renvix.app";
const localServerEnv = process.env.E2E_SPLIT_HOSTS === "1" ? runtimeEnv : {
  ...runtimeEnv,
  NEXT_PUBLIC_SITE_URL: localServerOrigin,
  NEXT_PUBLIC_AUTH_URL: localServerOrigin,
  NEXT_PUBLIC_APP_URL: localServerOrigin,
  NEXT_PUBLIC_ADMIN_URL: localServerOrigin
};

if (!npmCli) throw new Error("Run the E2E harness through npm so npm_execpath is available.");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 120000, init = undefined) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, init);
      if (response.ok) return;
    } catch {
      // The server can accept the socket before all production routes are ready.
    }
    await wait(1000);
  }

  throw new Error(`Timed out waiting for ${url}`);
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      windowsHide: true,
      ...options
    });
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
    if (process.env.E2E_SKIP_BUILD !== "1") {
      const buildCode = await run(process.execPath, [npmCli, "run", "build"], {
        env: {
          ...runtimeEnv,
          NODE_OPTIONS: `${process.env.NODE_OPTIONS || ""} --max-old-space-size=4096`.trim()
        }
      });
      if (buildCode !== 0) throw new Error("The production build failed before E2E tests.");
    }
    server = spawn(process.execPath, [npmCli, "run", "start", "--", "-H", host, "-p", port], {
      stdio: "inherit",
      windowsHide: true,
      env: localServerEnv
    });
    await waitForServer(new URL("/login", baseUrl));
    await waitForServer(new URL("/advanced-pro-control", baseUrl), 120000, {
      headers: { "x-forwarded-host": process.env.E2E_ADMIN_HOST || "wa-admin.renvix.app" }
    });
  }

  const code = await run(process.execPath, [playwrightCli, "test", "--config=playwright.config.ts", ...process.argv.slice(2)], {
    env: { ...runtimeEnv, E2E_BASE_URL: baseUrl }
  });
  await stopProcessTree(server);
  process.exit(code);
} catch (error) {
  await stopProcessTree(server);
  console.error(error);
  process.exit(1);
}
