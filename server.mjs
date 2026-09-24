import { createServer } from "node:http";
import { readFile, realpath, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const root = path.resolve(__dirname, process.env.SERVE_DIR || ".");
if (process.env.NODE_ENV === "production") throw new Error("Static preview server is disabled in production; use next start");
const bindHost = process.env.PREVIEW_BIND_HOST || "127.0.0.1";
const publicRoot = existsSync(path.join(root, "public")) ? path.join(root, "public") : root;

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml; charset=utf-8"
};

function safePath(urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0]);
  if (clean.includes("\\") || clean.includes("\0")) return null;
  if (clean === "/" || clean === "/index.html") return path.join(root, "index.html");
  if (clean.split("/").some(segment => segment.startsWith("."))) return null;
  if (!/^\/(?:app|assets|data|references|openapi)\//.test(clean) && clean !== "/favicon.ico") {
    // Extension-free SPA routes render only the trusted shell, never files.
    return !path.posix.extname(clean) ? path.join(root, "index.html") : null;
  }
  const filePath = clean.replace(/^\/+/, "");
  const resolved = path.resolve(publicRoot, filePath);
  const relative = path.relative(publicRoot, resolved);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative) ? resolved : null;
}

const previewServer = createServer(async (req, res) => {
  try {
    const requested = safePath(req.url || "/");
    if (!["GET", "HEAD"].includes(req.method)) { res.writeHead(405); res.end(); return; }
    if (!requested) { res.writeHead(404, { "Cache-Control": "no-store" }); res.end(); return; }
    const file = await realpath(requested);
    const base = await realpath(requested === path.join(root, "index.html") ? root : publicRoot);
    const relative = path.relative(base, file);
    if (relative.startsWith("..") || relative.split(path.sep).some(segment => segment.startsWith("."))
      || path.isAbsolute(relative) || !(await stat(file)).isFile()) {
      res.writeHead(404); res.end(); return;
    }
    const ext = path.extname(file);
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" });
    res.end(req.method === "HEAD" ? undefined : body);
  } catch {
    res.writeHead(404, { "Cache-Control": "no-store" }); res.end();
  }
}).listen(port, bindHost, () => {
  console.log(`Renvix preview is running at http://${bindHost}:${previewServer.address().port}`);
});
