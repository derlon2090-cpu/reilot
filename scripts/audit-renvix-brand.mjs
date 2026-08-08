import fs from "node:fs/promises";
import path from "node:path";

const roots = ["app", "src", "public/app"];
const extensions = new Set([".css", ".js", ".jsx", ".ts", ".tsx", ".svg"]);
const forbidden = [
  { label: "gradient", pattern: /(?:linear|radial|conic)-gradient|<linearGradient|<radialGradient|bg-gradient|from-blue|via-blue|to-blue/i },
  { label: "legacy color naming", pattern: /\b(?:blue|sky|indigo)\b/i },
  { label: "legacy logo reference", pattern: /renewpilot-logo|renvix-mark\.(?:webp|jpg)/i }
];

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(file));
    else if (extensions.has(path.extname(entry.name))) files.push(file);
  }
  return files;
}

const findings = [];
for (const root of roots) {
  for (const file of await walk(root)) {
    const content = await fs.readFile(file, "utf8");
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      forbidden.forEach(({ label, pattern }) => {
        if (pattern.test(line)) findings.push(`${file}:${index + 1} [${label}] ${line.trim().slice(0, 180)}`);
      });
    });
  }
}

if (findings.length) {
  console.error(findings.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Renvix brand audit passed: no legacy gradients, blue identity names, or old logo references in runtime assets.");
}
