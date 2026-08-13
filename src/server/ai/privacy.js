const SECRET_ASSIGNMENT = /\b(password|passwd|secret|secret[_ -]?key|api[_ -]?key|access[_ -]?token|refresh[_ -]?token|cookie|session|authorization)\b\s*[:=]\s*([^\s,;]+)/gi;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi;
const PROVIDER_KEY = /\b(?:sk|pk|ghp|gho|github_pat|xox[baprs]|re)_[A-Za-z0-9_-]{12,}\b/g;
const OTP = /\b(otp|one[- ]time(?: password| code)?|رمز التحقق|رمز الدخول)\b\s*[:=]?\s*([0-9]{4,8})\b/gi;
const CARD = /\b(card|credit card|بطاقة|رقم البطاقة)\b\s*[:=]?\s*((?:\d[ -]?){13,19})/gi;

export function redactAISecrets(value = "") {
  return String(value)
    .replace(BEARER, "Bearer [REDACTED]")
    .replace(SECRET_ASSIGNMENT, "$1=[REDACTED]")
    .replace(PROVIDER_KEY, "[REDACTED]")
    .replace(OTP, "$1 [REDACTED]")
    .replace(CARD, "$1 [REDACTED]");
}

export function sanitizeAIContext(value, depth = 0) {
  if (depth > 12) return "[TRUNCATED]";
  if (typeof value === "string") return redactAISecrets(value);
  if (Array.isArray(value)) return value.slice(0, 500).map((item) => sanitizeAIContext(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).slice(0, 500).map(([key, item]) => [key, sanitizeAIContext(item, depth + 1)]));
  }
  return value;
}
