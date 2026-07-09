import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const root = path.resolve(__dirname);

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
  const filePath = clean === "/" ? "index.html" : clean.replace(/^\/+/, "");
  const resolved = path.resolve(root, filePath);
  return resolved.startsWith(root) ? resolved : path.join(root, "index.html");
}

createServer(async (req, res) => {
  try {
    const requested = safePath(req.url || "/");
    const file = existsSync(requested) && !requested.endsWith(path.sep) ? requested : path.join(__dirname, "index.html");
    const ext = path.extname(file);
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
    res.end(body);
  } catch {
    const body = await readFile(path.join(__dirname, "index.html"));
    res.writeHead(200, { "Content-Type": types[".html"] });
    res.end(body);
  }
}).listen(port, () => {
  console.log(`RenewPilot AI is running at http://localhost:${port}`);
});
