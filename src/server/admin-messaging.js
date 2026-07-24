export const MESSAGING_SCOPES = Object.freeze({
  PLATFORM_ADMIN: "platform_admin",
  TENANT: "tenant"
});

export const MESSAGING_PROVIDERS = Object.freeze({
  EVOLUTION: "evolution",
  META: "meta_cloud_api",
  RESEND: "resend"
});

export function assertProviderAllowed({ scope, provider }) {
  const allowed = scope === MESSAGING_SCOPES.PLATFORM_ADMIN
    ? [MESSAGING_PROVIDERS.EVOLUTION, MESSAGING_PROVIDERS.RESEND]
    : scope === MESSAGING_SCOPES.TENANT
      ? [MESSAGING_PROVIDERS.META, MESSAGING_PROVIDERS.RESEND]
      : [];
  if (!allowed.includes(provider)) {
    const error = new Error(scope === MESSAGING_SCOPES.PLATFORM_ADMIN
      ? "ADMIN_PROVIDER_NOT_ALLOWED"
      : "TENANT_PROVIDER_NOT_ALLOWED");
    error.code = error.message;
    throw error;
  }
  return true;
}

export function templateVariables(content) {
  return [...new Set([...String(content || "").matchAll(/{{\s*([a-z][a-z0-9_]*)\s*}}/gi)].map((match) => match[1]))];
}

export function validateAdminTemplate({ subject = "", body = "", allowedVariables = [], requiredVariables = [] }) {
  const used = templateVariables(`${subject}\n${body}`);
  const invalid = used.filter((variable) => !allowedVariables.includes(variable));
  const missing = requiredVariables.filter((variable) => !used.includes(variable));
  if (invalid.length) return { ok: false, code: "VARIABLE_NOT_ALLOWED", variables: invalid };
  if (missing.length) return { ok: false, code: "REQUIRED_VARIABLE_MISSING", variables: missing };
  return { ok: true, used };
}

export function renderAdminTemplate(template, values, { maskTemporaryPassword = false } = {}) {
  const validation = validateAdminTemplate({
    subject: template.subject,
    body: template.body,
    allowedVariables: template.allowedVariables || [],
    requiredVariables: template.requiredVariables || []
  });
  if (!validation.ok) {
    const error = new Error(validation.code);
    error.code = validation.code;
    error.variables = validation.variables;
    throw error;
  }
  const missingValues = (template.requiredVariables || []).filter((variable) => values?.[variable] === undefined || values?.[variable] === null || values?.[variable] === "");
  if (missingValues.length) {
    const error = new Error("REQUIRED_VALUE_MISSING");
    error.code = "REQUIRED_VALUE_MISSING";
    error.variables = missingValues;
    throw error;
  }
  const replace = (content) => String(content || "").replace(/{{\s*([a-z][a-z0-9_]*)\s*}}/gi, (_, variable) => {
    if (maskTemporaryPassword && variable === "temporary_password") return "••••••••••••";
    return values?.[variable] === undefined || values?.[variable] === null ? `{{${variable}}}` : String(values[variable]);
  });
  return { subject: template.subject ? replace(template.subject) : null, body: replace(template.body) };
}

