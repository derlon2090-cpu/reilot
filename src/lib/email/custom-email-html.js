const ALLOWED_TAGS = new Set([
  "a", "b", "br", "div", "em", "h1", "h2", "h3", "h4", "hr", "i", "img", "li",
  "ol", "p", "section", "small", "span", "strong", "table", "tbody", "td", "tfoot", "th",
  "thead", "tr", "u", "ul"
]);

const VOID_TAGS = new Set(["br", "hr", "img"]);
const GLOBAL_ATTRIBUTES = new Set([
  "align", "alt", "aria-label", "border", "cellpadding", "cellspacing", "dir", "height", "href",
  "rel", "role", "src", "style", "target", "title", "valign", "width"
]);
const ALLOWED_STYLE_PROPERTIES = new Set([
  "background", "background-color", "border", "border-bottom", "border-color", "border-left",
  "border-radius", "border-right", "border-style", "border-top", "border-width", "color", "display",
  "font-family", "font-size", "font-style", "font-weight", "height", "letter-spacing", "line-height",
  "margin", "margin-bottom", "margin-left", "margin-right", "margin-top", "max-width", "min-width",
  "padding", "padding-bottom", "padding-left", "padding-right", "padding-top", "text-align",
  "text-decoration", "vertical-align", "white-space", "width"
]);
const ACTIVE_CONTENT = /<(?:script|style|iframe|object|embed|form|input|button|textarea|select|option|link|meta|base|svg|math)\b/i;
const UNSAFE_VALUE = /(?:javascript\s*:|vbscript\s*:|data\s*:\s*text\/html|expression\s*\(|@import|behavior\s*:|-moz-binding|url\s*\()/i;
const VARIABLE_PATTERN = /^{{\s*[^{}]+\s*}}$/;

export const EMAIL_TEMPLATE_MAX_HTML_CHARACTERS = Math.max(
  30000,
  Math.min(1000000, Math.floor(Number(process.env.EMAIL_TEMPLATE_MAX_HTML_CHARACTERS || 500000)))
);

function sanitizeUrl(value, attribute) {
  const input = String(value || "").trim();
  if (!input || UNSAFE_VALUE.test(input) || /&#(?:x0*6a|0*106);?/i.test(input)) return "";
  if (VARIABLE_PATTERN.test(input)) return input;
  if (attribute === "href" && (/^https:\/\//i.test(input) || /^(?:mailto|tel):/i.test(input) || input.startsWith("#"))) return input;
  if (attribute === "src" && (/^https:\/\//i.test(input) || /^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(input))) return input;
  return "";
}

function sanitizeStyle(value, warnings) {
  const clean = [];
  for (const declaration of String(value || "").split(";")) {
    const separator = declaration.indexOf(":");
    if (separator < 1) continue;
    const property = declaration.slice(0, separator).trim().toLowerCase();
    const styleValue = declaration.slice(separator + 1).trim();
    if (!ALLOWED_STYLE_PROPERTIES.has(property) || !styleValue || UNSAFE_VALUE.test(styleValue)) {
      if (property || styleValue) warnings.add("تم حذف خصائص CSS غير مدعومة أو غير آمنة.");
      continue;
    }
    clean.push(`${property}:${styleValue.slice(0, 300)}`);
  }
  return clean.join(";");
}

function escapeAttribute(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function inspectCustomEmailHtml(value, { maxLength = EMAIL_TEMPLATE_MAX_HTML_CHARACTERS } = {}) {
  const source = String(value || "").trim();
  const errors = [];
  const warnings = new Set();
  if (!source) return { ok: false, html: "", errors: ["أدخل كود HTML قبل اعتماده."], warnings: [] };
  if (source.length > maxLength) errors.push(`حجم الكود يتجاوز ${maxLength.toLocaleString("ar-SA")} حرف.`);
  if (ACTIVE_CONTENT.test(source)) errors.push("الكود يحتوي عنصرًا تنفيذيًا أو نموذجًا غير مسموح في البريد.");
  if (/<!doctype|<\/?(?:html|head|body)\b/i.test(source)) errors.push("اكتب محتوى الرسالة فقط دون html أو head أو body.");

  const stack = [];
  const withoutComments = source.replace(/<!--[\s\S]*?-->/g, "");
  const html = withoutComments.replace(/<\/?([a-zA-Z0-9-]+)([^>]*)>/g, (match, rawTag, rawAttributes) => {
    const tag = rawTag.toLowerCase();
    const closing = /^<\//.test(match);
    if (!ALLOWED_TAGS.has(tag)) {
      warnings.add(`تم حذف العنصر غير المدعوم <${tag}>.`);
      return "";
    }
    if (closing) {
      if (!VOID_TAGS.has(tag)) {
        const last = stack.pop();
        if (last !== tag) errors.push(`ترتيب إغلاق عنصر <${tag}> غير مكتمل.`);
      }
      return VOID_TAGS.has(tag) ? "" : `</${tag}>`;
    }
    if (!VOID_TAGS.has(tag)) stack.push(tag);
    const attributes = [];
    const attributePattern = /([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
    let attribute;
    while ((attribute = attributePattern.exec(rawAttributes))) {
      const name = attribute[1].toLowerCase();
      let attributeValue = attribute[2] ?? attribute[3] ?? attribute[4] ?? "";
      if (name.startsWith("on") || !GLOBAL_ATTRIBUTES.has(name)) {
        warnings.add("تم حذف خصائص HTML غير مدعومة أو غير آمنة.");
        continue;
      }
      if (name === "href" || name === "src") {
        attributeValue = sanitizeUrl(attributeValue, name);
        if (!attributeValue) {
          warnings.add("تم حذف رابط غير آمن أو غير مدعوم.");
          continue;
        }
      }
      if (name === "style") {
        attributeValue = sanitizeStyle(attributeValue, warnings);
        if (!attributeValue) continue;
      }
      if (name === "target") attributeValue = "_blank";
      if (name === "rel") attributeValue = "noopener noreferrer";
      attributes.push(`${name}="${escapeAttribute(attributeValue)}"`);
    }
    if (tag === "a" && attributes.some((item) => item.startsWith("target=")) && !attributes.some((item) => item.startsWith("rel="))) {
      attributes.push('rel="noopener noreferrer"');
    }
    return `<${tag}${attributes.length ? ` ${attributes.join(" ")}` : ""}>`;
  });
  if (stack.length) errors.push(`يوجد ${stack.length.toLocaleString("ar-SA")} عنصر HTML غير مغلق.`);
  return { ok: errors.length === 0, html: html.slice(0, maxLength), errors: [...new Set(errors)], warnings: [...warnings] };
}

export function supportedEmailDesign(value, fallback = "classic") {
  return ["classic", "modern", "minimal", "premium", "editorial", "commerce", "aurora", "executive"].includes(value) ? value : fallback;
}

export function supportedEmailContentMode(value, fallback = "preset") {
  return ["preset", "html"].includes(value) ? value : fallback;
}
