import fs from "node:fs/promises";
import path from "node:path";
import postcss from "postcss";

const cssFiles = [
  "src/styles/globals.css",
  "src/components/admin/AdminPortal.module.css",
  "src/components/admin-auth/AdminSetupForm.module.css",
  "app/docs/api/styles.css"
];

const sourceRoots = ["app", "src"];
const codeExtensions = new Set([".js", ".jsx", ".ts", ".tsx"]);
const brand = {
  darkest: "#062B28",
  hover: "#08332F",
  primary: "#0B3F3B",
  medium: "#3F7772",
  border: "#D6E7E4",
  muted: "#E8F1F0",
  soft: "#F3F8F7"
};

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

function tealForLightness(lightness) {
  if (lightness < 18) return brand.darkest;
  if (lightness < 38) return brand.primary;
  if (lightness < 66) return brand.medium;
  if (lightness < 84) return brand.border;
  if (lightness < 93) return brand.muted;
  return brand.soft;
}

function mapRgb(r, g, b) {
  const { h, s, l } = rgbToHsl(r, g, b);
  // Blue, cyan and purple identity colors. Red, orange, yellow and semantic green stay intact.
  if (s >= 18 && h >= 165 && h <= 285) return tealForLightness(l);
  return null;
}

function mapColorLiterals(value) {
  let result = value.replace(/#([0-9a-f]{6})(?![0-9a-f])/gi, (full, hex) => {
    const r = Number.parseInt(hex.slice(0, 2), 16);
    const g = Number.parseInt(hex.slice(2, 4), 16);
    const b = Number.parseInt(hex.slice(4, 6), 16);
    return mapRgb(r, g, b) || full;
  });
  result = result.replace(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(\s*,\s*[\d.]+)?\s*\)/gi, (full, r, g, b, alpha = "") => {
    const mapped = mapRgb(Number(r), Number(g), Number(b));
    if (!mapped) return full;
    const mr = Number.parseInt(mapped.slice(1, 3), 16);
    const mg = Number.parseInt(mapped.slice(3, 5), 16);
    const mb = Number.parseInt(mapped.slice(5, 7), 16);
    return alpha ? `rgba(${mr}, ${mg}, ${mb}${alpha})` : `rgb(${mr}, ${mg}, ${mb})`;
  });
  return result;
}

function solidForGradient(decl) {
  const selector = String(decl.parent?.selector || "").toLowerCase();
  const value = decl.value.toLowerCase();
  if (decl.prop === "background-image" || selector.includes("pattern") || selector.includes("texture")) return "none";
  if (/(danger|error|destructive|overdue)/.test(selector)) return "#EF4444";
  if (/(warning|pending|attention)/.test(selector)) return "#F59E0B";
  if (/(success|whatsapp|positive|healthy)/.test(selector)) return "#16A34A";
  if (/(button|btn|primary|active|selected|checked|toggle|switch|progress|meter|indicator|cta)/.test(selector)) return "var(--brand-primary)";
  if (/rgba?\(\s*255|#fff\b|#ffffff\b/.test(value)) return "var(--brand-primary-soft)";
  return "var(--brand-primary)";
}

function normalizeFonts(value) {
  if (!/(IBM Plex Sans Arabic|Cairo|Poppins|Tahoma|Segoe UI|Arial Rounded)/i.test(value)) return value;
  return 'var(--font-arabic, "Tajawal", sans-serif)';
}

async function migrateCss(file) {
  const input = await fs.readFile(file, "utf8");
  const root = postcss.parse(input, { from: file });
  root.walkDecls((decl) => {
    if (/gradient\(/i.test(decl.value)) {
      decl.value = solidForGradient(decl);
      return;
    }
    if (decl.prop === "font-family") {
      decl.value = normalizeFonts(decl.value);
      return;
    }
    decl.value = mapColorLiterals(decl.value);
  });
  root.walkRules((rule) => {
    const selector = String(rule.selector || "").toLowerCase();
    const surfaceHints = /(note|tip|intro|settings|welcome|editor|preview|unavailable|help|notice|skeleton|card\.reached)/;
    if (!surfaceHints.test(selector)) return;
    rule.walkDecls("background", (decl) => {
      if (decl.value === "var(--brand-primary)") decl.value = "var(--brand-primary-soft)";
    });
  });
  await fs.writeFile(file, root.toString(), "utf8");
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolute));
    else if (codeExtensions.has(path.extname(entry.name))) files.push(absolute);
  }
  return files;
}

async function migrateCode(file) {
  const input = await fs.readFile(file, "utf8");
  let output = mapColorLiterals(input);
  output = output
    .replace(/"IBM Plex Sans Arabic"\s*,\s*/g, "")
    .replace(/"Poppins"\s*,\s*/g, "");
  if (output !== input) await fs.writeFile(file, output, "utf8");
}

for (const file of cssFiles) await migrateCss(file);
for (const root of sourceRoots) {
  for (const file of await walk(root)) await migrateCode(file);
}

console.log(`Renvix identity migration complete: ${cssFiles.length} CSS entrypoints and runtime source files audited.`);
