const ACCOUNT_DATA_PATTERN = /اشتراك|تجديد|إيراد|دخل|حساب|أداء|تقرير|قناة|واتساب|بريد|تسليم|رسائل|حملة|باقة|خطة|استخدام|تذكرة|دعم|عملاء|نمو|renew|subscription|revenue|account|performance|report|channel|whatsapp|email|delivery|campaign|plan|usage|ticket|support|customer|growth/i;
const DEEP_ANALYSIS_PATTERN = /حلل بعمق|تحليل عميق|تحليل شامل|السبب الجذري|جذر المشكلة|ليش انخفض|لماذا انخفض|قارن.*(?:فتر|شهر|ربع|سنة)|عدة تقارير|مصادر متعددة|توقع|سيناريو|استراتيجية|deep analysis|root cause|why did|compare.*(?:period|month|quarter|year)|multiple reports|multi-source|forecast|scenario|strategy/i;
const CAUSAL_PATTERN = /سبب|أسباب|لماذا|ليش|علاقة|تأثير|انخفاض|ارتفاع|cause|reason|why|impact|decline|increase/i;
const COMPARISON_PATTERN = /قارن|مقارنة|مقابل|بين .* و|compare|versus|vs\.?|between .* and/i;
const SENSITIVE_ACTION_PATTERN = /احذف|ألغ|الغاء|إلغاء|أرسل|ارسل|فعّل|عطّل|اربط|افصل|ادفع|استرجاع|نفّذ|طبق|delete|cancel|send|enable|disable|connect|disconnect|pay|refund|execute|apply/i;

const DOMAIN_PATTERNS = [
  /اشتراك|تجديد|إيراد|renew|subscription|revenue/i,
  /قناة|واتساب|بريد|تسليم|channel|whatsapp|email|delivery/i,
  /حملة|رسائل|campaign|message/i,
  /تذكرة|دعم|ticket|support/i,
  /عميل|نمو|customer|growth/i
];

function countDomains(text) {
  return DOMAIN_PATTERNS.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
}

export function classifyAIRequest({
  prompt = "",
  conversationMessages = [],
  attachments = [],
  accountContextEnabled = true
} = {}) {
  const text = String(prompt).trim();
  const dataRequested = accountContextEnabled && ACCOUNT_DATA_PATTERN.test(text);
  const requiresConfirmation = SENSITIVE_ACTION_PATTERN.test(text);
  const domainCount = countDomains(text);
  let complexityScore = 0;

  if (DEEP_ANALYSIS_PATTERN.test(text)) complexityScore += 3;
  if (CAUSAL_PATTERN.test(text) && dataRequested) complexityScore += 1;
  if (COMPARISON_PATTERN.test(text)) complexityScore += 1;
  if (domainCount >= 3) complexityScore += 2;
  else if (domainCount === 2) complexityScore += 1;
  if (text.length >= 900) complexityScore += 1;
  if (Array.isArray(conversationMessages) && conversationMessages.length >= 12) complexityScore += 1;
  if (Array.isArray(attachments) && attachments.length >= 2) complexityScore += 1;

  const deepAnalysis = complexityScore >= 3;
  return Object.freeze({
    intent: requiresConfirmation
      ? "sensitive_action"
      : deepAnalysis
        ? "deep_analysis"
        : dataRequested
          ? "account_query"
          : "general_chat",
    modelTier: deepAnalysis ? "pro" : "flash",
    thinking: deepAnalysis ? "enabled" : "disabled",
    reasoningEffort: deepAnalysis ? "max" : null,
    useTools: dataRequested,
    maxToolIterations: deepAnalysis ? 6 : 3,
    requiresConfirmation,
    complexityScore
  });
}

export function routingSystemInstruction(route = {}) {
  if (route.requiresConfirmation) {
    return "الطلب يتضمن إجراءً حساسًا. لا تدّع التنفيذ ولا تستدعِ أي أداة كتابية قبل التحقق من الصلاحية وعرض ملخص واضح والحصول على تأكيد صريح من المستخدم. أدوات هذه المحادثة الحالية للقراءة فقط.";
  }
  if (route.intent === "deep_analysis") {
    return "نفّذ تحليلًا سببيًا متعدد المصادر. افصل بين الحقائق والاستنتاجات، واربط كل نتيجة بالدليل الذي أعادته أدوات Renvix.";
  }
  return "تعامل مع الطلب بأقصر مسار موثوق، ولا تستدعِ أدوات الحساب إلا عندما يحتاج السؤال بيانات فعلية.";
}
