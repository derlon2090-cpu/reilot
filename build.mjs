import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, "dist");
const publicApp = path.join(root, "public", "app");

await mkdir(publicApp, { recursive: true });
await cp(path.join(root, "src", "app", "app.js"), path.join(publicApp, "app.js"));
await mkdir(path.join(publicApp, "styles"), { recursive: true });
await cp(path.join(root, "src", "styles", "globals.css"), path.join(publicApp, "styles", "globals.css"));
await cp(path.join(root, "src", "styles", "tokens.css"), path.join(publicApp, "styles", "tokens.css"));
await mkdir(path.join(publicApp, "locales"), { recursive: true });
await cp(path.join(root, "src", "locales"), path.join(publicApp, "locales"), { recursive: true });
await mkdir(path.join(root, "public", "data"), { recursive: true });
await cp(path.join(root, "src", "data"), path.join(root, "public", "data"), { recursive: true });

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

await cp(path.join(root, "index.html"), path.join(dist, "index.html"));
await cp(path.join(root, "public"), dist, { recursive: true });

console.log("Built RenewPilot AI static files in dist");
