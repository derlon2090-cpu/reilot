export const SALLA_PAGE_CSS_VARIABLES = Object.freeze([
  "--salla-page-background",
  "--salla-card-background",
  "--salla-text-color",
  "--salla-muted-color",
  "--salla-card-radius",
  "--salla-button-radius",
  "--salla-card-shadow",
  "--salla-page-gap"
]);

const ALLOWED = new Set(SALLA_PAGE_CSS_VARIABLES);
const MAX_CODE_LENGTH = 4000;
const UNSAFE_VALUE = /(?:url\s*\(|expression\s*\(|javascript\s*:|@import|behavior\s*:|-moz-binding|[<>{}])/i;

function cleanValue(value) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim().slice(0, 180);
  if (!normalized || UNSAFE_VALUE.test(normalized)) return "";
  return /^[#(),.%\w\s+\-*/]+$/u.test(normalized) ? normalized : "";
}

export function normalizeSallaPageCssCode(value) {
  const source = String(value || "").replace(/\/\*[\s\S]*?\*\//g, "").slice(0, MAX_CODE_LENGTH);
  if (UNSAFE_VALUE.test(source)) return "";
  const declarations = new Map();
  for (const part of source.split(/[;\n\r]+/)) {
    const separator = part.indexOf(":");
    if (separator < 1) continue;
    const property = part.slice(0, separator).trim().toLowerCase();
    const propertyValue = cleanValue(part.slice(separator + 1));
    if (ALLOWED.has(property) && propertyValue) declarations.set(property, propertyValue);
  }
  return [...declarations].map(([property, propertyValue]) => `${property}: ${propertyValue};`).join("\n");
}

export function sallaPageCssVariables(value) {
  const output = {};
  for (const line of normalizeSallaPageCssCode(value).split("\n")) {
    const separator = line.indexOf(":");
    if (separator < 1) continue;
    const property = line.slice(0, separator).trim();
    const propertyValue = line.slice(separator + 1).replace(/;$/, "").trim();
    if (ALLOWED.has(property) && propertyValue) output[property] = propertyValue;
  }
  return output;
}
