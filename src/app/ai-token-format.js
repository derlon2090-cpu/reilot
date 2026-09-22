export function formatAITokenCount(value, language = "ar") {
  const number = Number(value);
  const tokens = Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0;
  return tokens.toLocaleString(language === "en" ? "en-US" : "ar-SA", { maximumFractionDigits: 0 });
}
