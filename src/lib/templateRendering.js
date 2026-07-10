const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function findTemplateVariables(template) {
  return [...template.matchAll(VARIABLE_PATTERN)].map((match) => match[1]);
}

export function renderTemplate(template, variables) {
  const missing = [];
  const rendered = template.replace(VARIABLE_PATTERN, (_, key) => {
    const value = variables[key];
    if (value === undefined || value === null || value === "") {
      missing.push(key);
      return `{{${key}}}`;
    }

    return String(value);
  });

  if (missing.length > 0) {
    throw new Error(`Missing template variables: ${[...new Set(missing)].join(", ")}`);
  }

  if (VARIABLE_PATTERN.test(rendered)) {
    throw new Error("Template contains unresolved variables");
  }

  return rendered;
}

export function validateMessagePayload({ toNumber, body, renewalUrl }) {
  if (!toNumber) return { ok: false, error: "Customer phone number is required" };
  if (!body) return { ok: false, error: "Message body is required" };
  if (body.includes("{{")) return { ok: false, error: "Message contains unresolved template variables" };
  if (body.includes("renewal_url") && !renewalUrl) return { ok: false, error: "Renewal URL is required" };
  return { ok: true };
}
